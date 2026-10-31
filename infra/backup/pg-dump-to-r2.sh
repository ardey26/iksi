#!/usr/bin/env bash
# Dumps the app's public schema and uploads it to the private R2 bucket.
# Env: BACKUP_DATABASE_URL (Supabase session pooler, port 5432, IPv4),
#      R2_ACCOUNT_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
# Prints the local dump path on the last line.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?}" "${R2_ACCOUNT_ID:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"

out_dir="${OUT_DIR:-$(mktemp -d)}"
file="iksi-$(date -u +%Y-%m-%dT%H%MZ).dump"

# pg_dump runs from the postgres:17 image so its version always matches the
# restore check and is never older than the server. Only the public schema:
# Supabase's own schemas (auth, storage, ...) need Supabase to restore.
docker run --rm --add-host=host.docker.internal:host-gateway -v "$out_dir:/out" postgres:17 \
	pg_dump "$BACKUP_DATABASE_URL" -Fc --no-owner --no-privileges --schema=public -f "/out/$file"

size="$(wc -c < "$out_dir/$file" | tr -d ' ')"
if [ "$size" -lt 10240 ]; then
	echo "pg-dump-to-r2: dump is only $size bytes, refusing to upload" >&2
	exit 1
fi

aws s3 cp "$out_dir/$file" "s3://iksi-backups/pg/$file" \
	--endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" --region auto --only-show-errors
echo "pg-dump-to-r2: uploaded pg/$file ($size bytes)"
echo "$out_dir/$file"
