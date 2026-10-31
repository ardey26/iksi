# Images in R2 runbook

Avatars are uploaded to the `iksi-media` bucket and served from `https://cdn.iksi.app`. The one-time bucket, domain, token and env var setup lives in `infra/SETUP.md`; this file covers only what is specific to images.

## 1. Prerequisites (see `infra/SETUP.md`)

- Section 2.6: `iksi-media` bucket exists, `cdn.iksi.app` is connected, `r2.dev` stays **disabled**.
- Section 2.7: the R2 token is scoped to `iksi-backups` and `iksi-media`.
- Section 4.2: Vercel has `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_MEDIA_BUCKET=iksi-media` and `MEDIA_BASE_URL=https://cdn.iksi.app` for Production and Preview.

## 2. Migration

Nothing to do by hand. `.github/workflows/deploy.yml` runs `prisma migrate deploy` before each production web deploy, after CI passes on `main`. The new columns are nullable.

Fallback, only if the workflow cannot run (session-pooler URL from `infra/SETUP.md` section 3):

```sh
export DATABASE_URL='<DATABASE_SESSION_URL>' DIRECT_URL='<DATABASE_SESSION_URL>'
npx -y pnpm@10.34.6 --filter @iksi/web exec prisma migrate deploy
```

## 3. Visual check on the first preview deploy

Light and dark themes, at 375 px and 1280 px:

1. Upload an avatar. The layout must not shift while it uploads.
2. Trigger an upload error. The error line's space is reserved, so nothing jumps.

## 4. Verify after deploy

1. In the dashboard, upload an avatar and copy the returned image URL.
2. Request it twice:

   ```sh
   curl -sI <returned url>
   curl -sI <returned url>
   ```

3. Both must show `200`, `content-type: image/webp` and `cache-control: public, max-age=31536000, immutable`. The second must also show `cf-cache-status: HIT`.

## 5. Mirror existing avatars

Copies avatars hosted elsewhere into R2. It needs `DATABASE_URL` (the Supabase session-pooler URL, as in `infra/SETUP.md` section 3) and the `R2_*` variables from section 4.2 in the shell.

1. Dry run, then read the JSON report:

   ```sh
   npx -y pnpm@10.34.6 --filter @iksi/web mirror-avatars -- --dry-run
   ```

2. If the report looks right, run it for real:

   ```sh
   npx -y pnpm@10.34.6 --filter @iksi/web mirror-avatars
   ```

## Rollback

- The app still renders old `avatarUrl` values that point elsewhere.
- The new columns are nullable.
- Reverting the deploy is safe.
