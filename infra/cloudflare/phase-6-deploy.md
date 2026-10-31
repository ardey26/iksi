# Phase 6 deploy: smart routing, expiry, passwords and preview

Adds routing rules, expiry (date and click cap), link passwords, `/{slug}+` preview and the flagged-link page. Schema change is additive: five nullable columns and one defaulted boolean on `LongURL` (`prisma/migrations/20261101010000_link_settings`). Old code ignores them, so the migration is safe while old code runs.

## 1. Before the first preview (manual migration)

Vercel previews share the production database; the migration only runs from the Deploy workflow on `main`. A preview of this branch needs the columns first, so apply the migration by hand:

```sh
export DATABASE_URL='<DATABASE_SESSION_URL>' DIRECT_URL='<DATABASE_SESSION_URL>'
pnpm --filter @iksi/web exec prisma migrate deploy
```

`DATABASE_SESSION_URL` is described in `infra/SETUP.md` section 3.

**Settings saved in a preview change real links.** Use a throwaway link.

## 2. Preview visual check (owed from Task 7)

On the first preview:

- [ ] Link settings panel and rules editor, light and dark themes, at 375 px and 1280 px.
- [ ] Every control works with the keyboard alone.
- [ ] No layout shift when sections open or errors appear.
- [ ] The preview (`/{slug}+`), password, expired and flagged pages, same widths and themes.

## 3. Deploy

Merge to `main`. After CI passes, `.github/workflows/deploy.yml` applies the migration, deploys the web app, then deploys the Worker, in that order. Order matters: the Worker reads the new record fields, so the origin must already serve them. Watch it under GitHub → Actions → Deploy.

Fallback, only when the workflow itself is broken. Same steps, same order:

```sh
# 1. Migrations (session pooler, port 5432)
export DATABASE_URL='<DATABASE_SESSION_URL>' DIRECT_URL='<DATABASE_SESSION_URL>'
pnpm --filter @iksi/web exec prisma migrate deploy

# 2. Web app (needs VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID exported)
npx --yes vercel@65.9.0 pull --yes --environment=production --token="$VERCEL_TOKEN"
npx --yes vercel@65.9.0 build --prod --token="$VERCEL_TOKEN"
npx --yes vercel@65.9.0 deploy --prebuilt --prod --token="$VERCEL_TOKEN"

# 3. Worker
cd apps/redirect
npx -y pnpm@10.34.6 exec wrangler login
npx -y pnpm@10.34.6 exec wrangler secret put EDGE_SECRET
npx -y pnpm@10.34.6 exec wrangler deploy --var VERSION:$(git rev-parse HEAD)
```

## 4. Verify

Each check changes link state, so use a separate throwaway link per check (any destination you control, called "default" below). Do not reuse one link: a password on it would block the click-cap check.

- [ ] Worker and origin share the secret:
  ```sh
  curl -s 'https://www.iksi.app/_health?deep=1'
  ```
  The JSON shows `"origin":"ok"`.
- [ ] Device rule, link `<slug-device>`. Add a rule `devices: ['mobile']` with destination "mobile".
  ```sh
  curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" https://www.iksi.app/<slug-device> | grep -i "^location"   # lands on "mobile"
  curl -sI https://www.iksi.app/<slug-device> | grep -i "^location"                                                              # lands on "default"
  ```
- [ ] Password, link `<slug-password>`. Set a password on it.
  ```sh
  curl -s -o /dev/null -w '%{http_code}\n' https://www.iksi.app/<slug-password>
  ```
  Prints `200` (the password page, not a redirect to the destination).
- [ ] Preview. `https://www.iksi.app/<slug-device>+` shows the preview page for the "default" destination.
- [ ] Click cap, link `<slug-cap>` (no password). Set `maxClicks` to its current click count + 1, then click it once in a browser (it lands on "default"). Wait up to 3 minutes: the Worker's cached record can last about 60 s and the click reaches the database through the queue.
  ```sh
  curl -sI https://www.iksi.app/<slug-cap> | head -1
  ```
  Returns `410`. If it still answers `302`, check `x-iksi-route` on the response (`curl -sI`), `curl -s 'https://www.iksi.app/_health?deep=1'`, and the `iksi-clicks-dlq` queue for stuck click batches.
- [ ] Flagged link, `<slug-flagged>`. Flag it (dashboard or database), then:
  ```sh
  curl -sI https://www.iksi.app/<slug-flagged>
  ```
  Returns `403` from the origin (the Worker passes it through). Then open `https://www.iksi.app/<slug-flagged>+`: it shows the warning with no Continue button.

Any failing check blocks the rollout; see Rollback.

## 5. Rollback

Worker first, then the web app.

```sh
npx -y pnpm@10.34.6 --filter @iksi/redirect exec wrangler deployments list
npx -y pnpm@10.34.6 --filter @iksi/redirect exec wrangler rollback <version-id> -m "<reason>" -y
```

Then redeploy the previous web deployment (Vercel → Deployments → previous production deploy → Promote, or revert on `main`). The new columns stay in the database; old code ignores them, so do not drop them.

A later push to `main` redeploys the Worker, so revert the offending commit as well.
