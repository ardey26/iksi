# Cloudflare cutover runbook

Moves `iksi.app` DNS from Vercel to Cloudflare, puts Cloudflare's proxy in front of Vercel, and deploys the pass-through redirect Worker. Nothing user-visible changes. Budget: about 45 minutes plus nameserver propagation.

The record set Vercel serves today is in `dns-export-vercel.txt`. Notable: no MX, no TXT, and a wildcard `*` record that Vercel creates by default. The wildcard is **not** carried over.

## 1. Add the zone (Free plan)

Cloudflare dashboard → Add a site → `iksi.app` → Free. Then make the DNS records exactly this, deleting anything else Cloudflare imported:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | the apex IP Vercel's domain page shows (today `216.198.79.1`) | Proxied |
| CNAME | `www` | the target Vercel's domain page shows for `www` (`cname.vercel-dns.com` or a project-specific one) | Proxied |
| CNAME | `admin` | same target as `www` | Proxied |

## 2. Zone settings, before switching nameservers

- SSL/TLS → Overview: **Full (strict)**.
- SSL/TLS → Edge Certificates: Always Use HTTPS **on**, Automatic HTTPS Rewrites **off**.
- Speed → Optimization: Rocket Loader **off**, Auto Minify **off** (if present).
- Caching → Configuration: Browser Cache TTL **Respect Existing Headers**.
- Rules → Cache Rules → new rule "Bypass cache for app":
  `(http.host in {"iksi.app" "www.iksi.app"} and not starts_with(http.request.uri.path, "/_app/") and not starts_with(http.request.uri.path, "/fonts/"))` → **Bypass cache**.

Cloudflare must never cache HTML; Vercel's edge still does that per its own headers.

## 3. Switch nameservers

At the registrar for `iksi.app`, replace `ns1.vercel-dns.com` and `ns2.vercel-dns.com` with the two nameservers Cloudflare assigned. Wait until the zone shows **Active**.

```sh
dig +short NS iksi.app                                   # two *.ns.cloudflare.com
curl -sI https://www.iksi.app/ | grep -i cf-ray          # present
curl -sI https://www.iksi.app/@andre | grep -iE "^HTTP|x-vercel-id"   # 200 and a Vercel id
```

## 4. Re-verify domains in Vercel

Vercel → Project → Settings → Domains: `iksi.app`, `www.iksi.app`, `admin.iksi.app` must all show valid configuration. If Vercel asks for a `_vercel` TXT record, add it in Cloudflare as **DNS only** and wait for the check.

## 5. Enable Workers Paid and deploy the Worker

Cloudflare → Workers & Pages → Plans → **Workers Paid** ($5/month).

```sh
pnpm --filter @iksi/redirect exec wrangler login
pnpm --filter @iksi/redirect exec wrangler deploy
```

Verify:

```sh
curl -s https://www.iksi.app/_health                      # {"ok":true,"colo":"SIN",...}
curl -sI https://www.iksi.app/QdM2whH | grep -iE "^HTTP|x-iksi-route|location"   # 302, slug, same location as before
curl -sI https://www.iksi.app/@andre  | grep -i x-iksi-route                      # reserved
```

Then sign in once with Google and once with Twitter in a browser. Both must complete.

## 6. Latency sanity check

```sh
for i in 1 2 3 4 5; do curl -s -o /dev/null -w '%{time_starttransfer}\n' -I https://www.iksi.app/QdM2whH; done
```

Expect within about 30 ms of the baseline in `perf/reports/`. If any request takes over 1 s, check the cache rule and the Full (strict) setting first.

## Rollback

- Worker misbehaving: `pnpm --filter @iksi/redirect exec wrangler delete`, or remove its routes in the dashboard. Traffic goes straight to Vercel through the proxy.
- Proxy misbehaving: set the three records to **DNS only** (grey cloud). Traffic goes straight to Vercel.
- Everything: point the nameservers back to `ns1/ns2.vercel-dns.com`. Vercel still holds the original zone.
