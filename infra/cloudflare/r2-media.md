# Images in R2 runbook

Avatars are uploaded to the `iksi-media` bucket and served from `https://cdn.iksi.app`. The one-time bucket, domain, token and env var setup lives in `infra/SETUP.md`; this file covers only what is specific to images.

## 1. Prerequisites (see `infra/SETUP.md`)

- Section 2.6: `iksi-media` bucket exists, `cdn.iksi.app` is connected, `r2.dev` stays **disabled**.
- Section 2.7: the R2 token is scoped to `iksi-backups` and `iksi-media`.
- Section 4.2: Vercel has `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_MEDIA_BUCKET=iksi-media` and `MEDIA_BASE_URL=https://cdn.iksi.app` for Production and Preview.
- Section 3: the two `prisma migrate resolve` commands were run. If skipped, the deploy workflow's "Database migrations" step fails trying to re-run them; run section 3, then re-run the workflow.
- Section 5: the GitHub `production` environment and its secrets exist, including `DATABASE_SESSION_URL`. Without them the migration step cannot connect.

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
2. Trigger an upload error: upload a file over 4 MB, or a text file renamed to `.png`. The error line's space is reserved, so nothing jumps.

## 4. Verify after deploy

1. In the dashboard, upload an avatar and copy the returned image URL.
2. Request it twice:

   ```sh
   curl -sI <returned url>
   curl -sI <returned url>
   ```

3. Both must show `200`, `content-type: image/webp` and `cache-control: public, max-age=31536000, immutable`. The second must also show `cf-cache-status: HIT`.

## 5. Mirror existing avatars

Copies avatars hosted elsewhere into R2. Set these in your shell first (placeholders below; `DATABASE_SESSION_URL` is the session-pooler URL from `infra/SETUP.md` section 3). Do not paste the real values anywhere else.

```sh
export DATABASE_URL='<DATABASE_SESSION_URL>'
export DIRECT_URL='<DATABASE_SESSION_URL>'
export R2_ACCOUNT_ID='<account id>'
export R2_ACCESS_KEY_ID='<access key id>'
export R2_SECRET_ACCESS_KEY='<secret access key>'
# Optional, defaults shown:
# export R2_MEDIA_BUCKET='iksi-media'
# export MEDIA_BASE_URL='https://cdn.iksi.app'
```

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
