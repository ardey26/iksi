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

Create one test link, `<slug>`, with a throwaway destination.

- [ ] Worker and origin share the secret:
  ```sh
  curl -s 'https://www.iksi.app/_health?deep=1'
  ```
  The JSON shows `"origin":"ok"`.
- [ ] Device rule. Add a rule `devices: ['mobile']` with a different destination.
  ```sh
  curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" https://www.iksi.app/<slug> | grep -i "^location"   # rule destination
  curl -sI https://www.iksi.app/<slug> | grep -i "^location"                                                              # default destination
  ```
- [ ] Password. Set one on the link.
  ```sh
  curl -s -o /dev/null -w '%{http_code}\n' https://www.iksi.app/<slug>
  ```
  Prints `200` (the password page, not a redirect).
- [ ] Preview. `https://www.iksi.app/<slug>+` shows the preview page.
- [ ] Click cap. Set `maxClicks` to the current click count + 1, click the link once, then wait up to a minute.
  ```sh
  curl -sI https://www.iksi.app/<slug> | head -1
  ```
  Returns `410`.
- [ ] Flagged link. Flag a throwaway link (dashboard or database), then:
  ```sh
  curl -sI https://www.iksi.app/<slug>
  ```
  Returns `403` from the origin (the Worker passes it through). Then open `https://www.iksi.app/<slug>+`: it shows the warning with no Continue button.

Any failing check blocks the rollout; see Rollback.

## 5. Rollback

Worker first, then the web app.

```sh
npx -y pnpm@10.34.6 --filter @iksi/redirect exec wrangler deployments list
npx -y pnpm@10.34.6 --filter @iksi/redirect exec wrangler rollback <version-id> -m "<reason>" -y
```

Then redeploy the previous web deployment (Vercel → Deployments → previous production deploy → Promote, or revert on `main`). The new columns stay in the database; old code ignores them, so do not drop them.

A later push to `main` redeploys the Worker, so revert the offending commit as well.
