#!/usr/bin/env bash
# Proves restore-check.sh accepts a real dump and rejects broken ones.
# Needs only Docker. Run: bash infra/backup/restore-check.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
src="iksi-backup-test-src-$$"
trap 'docker rm -f "$src" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

docker run -d --rm --name "$src" -e POSTGRES_PASSWORD=test -p 127.0.0.1::5432 postgres:17 >/dev/null
for _ in $(seq 1 60); do
	docker exec "$src" psql -U postgres -h 127.0.0.1 -tAc 'select 1' >/dev/null 2>&1 && break
	sleep 1
done

sql() { docker exec "$src" psql -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 -qc "$1" >/dev/null; }
dump() { docker exec "$src" pg_dump -U postgres -h 127.0.0.1 -Fc -f /tmp/out.dump postgres && docker cp "$src:/tmp/out.dump" "$1" >/dev/null; }

sql 'create table "User" (id serial primary key); create table "LongURL" (id serial primary key, "shortURL" text);'
sql 'insert into "User" default values; insert into "LongURL" ("shortURL") values ($$abc$$);'
dump "$tmp/valid.dump"

sql 'delete from "LongURL";'
dump "$tmp/zero-rows.dump"

: > "$tmp/empty.dump"

fail=0
if bash "$here/restore-check.sh" "$tmp/valid.dump" >/dev/null 2>&1; then
	echo "ok: valid dump accepted"
else
	echo "FAIL: valid dump rejected"; fail=1
fi
if bash "$here/restore-check.sh" "$tmp/empty.dump" >/dev/null 2>&1; then
	echo "FAIL: empty dump accepted"; fail=1
else
	echo "ok: empty dump rejected"
fi
if bash "$here/restore-check.sh" "$tmp/zero-rows.dump" >/dev/null 2>&1; then
	echo "FAIL: zero-row dump accepted"; fail=1
else
	echo "ok: zero-row dump rejected"
fi
# pg-dump-to-r2.sh must refuse to upload a tiny dump. The fake credentials
# guarantee that reaching the upload step would fail differently.
port="$(docker port "$src" 5432/tcp | head -1 | sed 's/.*://')"
if out="$(BACKUP_DATABASE_URL="postgresql://postgres:test@host.docker.internal:$port/postgres" \
	R2_ACCOUNT_ID=none AWS_ACCESS_KEY_ID=none AWS_SECRET_ACCESS_KEY=none OUT_DIR="$tmp" \
	bash "$here/pg-dump-to-r2.sh" 2>&1)"; then
	echo "FAIL: tiny dump uploaded"; fail=1
elif echo "$out" | grep -q "refusing to upload"; then
	echo "ok: tiny dump refused before upload"
else
	echo "FAIL: dump script failed for another reason: $out"; fail=1
fi
exit "$fail"
