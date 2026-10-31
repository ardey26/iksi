#!/usr/bin/env bash
# Dumps the app's public schema and uploads it to the private R2 bucket.
# Env: BACKUP_DATABASE_URL (Supabase session pooler, port 5432, IPv4),
#      R2_ACCOUNT_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
# Optional: OUT_DIR (default: a temp dir), MIN_DUMP_BYTES (default 10240),
#      BACKUP_DOCKER_NETWORK (docker --network value for the pg_dump container).
# Prints the local dump path on the last line.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?}" "${R2_ACCOUNT_ID:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"

here="$(cd "$(dirname "$0")" && pwd)"
out_dir="${OUT_DIR:-$(mktemp -d)}"
min_bytes="${MIN_DUMP_BYTES:-10240}"
file="iksi-$(date -u +%Y-%m-%dT%H%MZ).dump"

network_args=()
[ -n "${BACKUP_DOCKER_NETWORK:-}" ] && network_args=(--network "$BACKUP_DOCKER_NETWORK")

# pg_dump runs from the postgres:17 image so its version always matches the
# restore check and is never older than the server. Only the public schema:
# Supabase's own schemas (auth, storage, ...) need Supabase to restore.
docker run --rm ${network_args[@]+"${network_args[@]}"} -v "$out_dir:/out" postgres:17 \
	pg_dump "$BACKUP_DATABASE_URL" -Fc --no-owner --no-privileges --schema=public -f "/out/$file"

size="$(wc -c < "$out_dir/$file" | tr -d ' ')"
if [ "$size" -lt "$min_bytes" ]; then
	echo "pg-dump-to-r2: dump is only $size bytes, refusing to upload" >&2
	exit 1
fi
bash "$here/check-archive.sh" "$out_dir/$file"

aws s3 cp "$out_dir/$file" "s3://iksi-backups/pg/$file" \
	--endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" --region auto --only-show-errors
echo "pg-dump-to-r2: uploaded pg/$file ($size bytes)"
echo "$out_dir/$file"
