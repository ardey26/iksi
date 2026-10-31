#!/usr/bin/env bash
# Exercises the backup scripts end to end against a throwaway Postgres.
# Every dump is produced by pg-dump-to-r2.sh itself (same flags as
# production) with the upload stubbed by a fake `aws` on PATH.
# Needs only Docker; works on Docker Desktop and on Linux CI runners
# because pg_dump joins the source container's network namespace.
# Run: bash infra/backup/restore-check.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
src="iksi-backup-test-src-$$"
trap 'docker rm -f "$src" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

docker run -d --rm --name "$src" -e POSTGRES_PASSWORD=test postgres:17 >/dev/null
for _ in $(seq 1 60); do
	docker exec "$src" psql -U postgres -h 127.0.0.1 -tAc 'select 1' >/dev/null 2>&1 && break
	sleep 1
done

sql() { docker exec "$src" psql -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 -qc "$1" >/dev/null; }

# Fake `aws s3 cp <file> s3://bucket/key`: records the upload locally.
mkdir -p "$tmp/bin" "$tmp/r2"
cat > "$tmp/bin/aws" <<EOF
#!/usr/bin/env bash
[ "\$1 \$2" = "s3 cp" ] && cp "\$3" "$tmp/r2/\$(basename "\$4")"
EOF
chmod +x "$tmp/bin/aws"

# run_dump <out_dir> [min_bytes]: the production script, pointed at the test DB.
run_dump() {
	mkdir -p "$1"
	env PATH="$tmp/bin:$PATH" \
		BACKUP_DOCKER_NETWORK="container:$src" \
		BACKUP_DATABASE_URL="postgresql://postgres:test@127.0.0.1:5432/postgres" \
		R2_ACCOUNT_ID=test AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
		OUT_DIR="$1" ${2:+"MIN_DUMP_BYTES=$2"} \
		bash "$here/pg-dump-to-r2.sh"
}

fail=0
pass() { echo "ok: $1"; }
flunk() { echo "FAIL: $1"; fail=1; }

sql 'create table "User" (id serial primary key); create table "LongURL" (id serial primary key, "shortURL" text);'
sql 'insert into "User" default values; insert into "LongURL" ("shortURL") values ($$abc$$);'

if valid="$(run_dump "$tmp/valid" 0 | tail -1)" && [ -s "$valid" ]; then
	pass "dump script produced and uploaded a dump"
else
	flunk "dump script failed on a healthy database"; valid=""
fi
[ -n "$valid" ] && [ -s "$tmp/r2/$(basename "$valid")" ] && pass "upload received the dump" || flunk "upload did not receive the dump"

if [ -n "$valid" ] && bash "$here/restore-check.sh" "$valid" >/dev/null 2>&1; then
	pass "production-flag dump restores"
else
	flunk "production-flag dump rejected"
fi

: > "$tmp/empty.dump"
bash "$here/restore-check.sh" "$tmp/empty.dump" >/dev/null 2>&1 && flunk "empty dump accepted" || pass "empty dump rejected"

if [ -n "$valid" ]; then
	size="$(wc -c < "$valid" | tr -d ' ')"
	head -c "$((size / 2))" "$valid" > "$tmp/truncated.dump"
	bash "$here/check-archive.sh" "$tmp/truncated.dump" >/dev/null 2>&1 && flunk "truncated dump passed the archive check" || pass "truncated dump fails the archive check"
	bash "$here/check-archive.sh" "$valid" >/dev/null 2>&1 && pass "valid dump passes the archive check" || flunk "valid dump failed the archive check"
fi

sql 'delete from "LongURL";'
if zero="$(run_dump "$tmp/zero" 0 | tail -1)" && bash "$here/restore-check.sh" "$zero" >/dev/null 2>&1; then
	flunk "zero-row dump accepted"
else
	pass "zero-row dump rejected"
fi

# Default floor is 10 KB; this database is far smaller, so nothing may upload.
before="$(ls "$tmp/r2" | wc -l | tr -d ' ')"
if out="$(run_dump "$tmp/tiny" 2>&1)"; then
	flunk "tiny dump uploaded"
elif echo "$out" | grep -q "refusing to upload" && [ "$(ls "$tmp/r2" | wc -l | tr -d ' ')" = "$before" ]; then
	pass "tiny dump refused before upload"
else
	flunk "dump script failed for another reason: $out"
fi

exit "$fail"
