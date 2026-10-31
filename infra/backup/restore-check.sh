#!/usr/bin/env bash
# Restores a pg_dump custom-format archive into a throwaway Postgres 17
# container and fails unless the core tables came back with rows.
# Usage: restore-check.sh <file.dump>
set -euo pipefail

dump="${1:?usage: restore-check.sh <file.dump>}"
[ -s "$dump" ] || { echo "restore-check: $dump is missing or empty" >&2; exit 1; }

name="iksi-restore-check-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=check postgres:17 >/dev/null
ready=0
for _ in $(seq 1 60); do
	# TCP only answers once initdb's temporary server has handed over.
	if docker exec "$name" psql -U postgres -h 127.0.0.1 -tAc 'select 1' >/dev/null 2>&1; then
		ready=1; break
	fi
	sleep 1
done
[ "$ready" = 1 ] || { echo "restore-check: postgres did not start" >&2; exit 1; }

docker cp "$dump" "$name:/tmp/restore.dump" >/dev/null
docker exec "$name" pg_restore --no-owner --no-privileges --exit-on-error \
	-U postgres -h 127.0.0.1 -d postgres /tmp/restore.dump

for table in User LongURL; do
	count="$(docker exec "$name" psql -U postgres -h 127.0.0.1 -tAc "select count(*) from \"$table\"")"
	echo "restore-check: \"$table\" rows: $count"
	[ "$count" -gt 0 ] || { echo "restore-check: \"$table\" is empty" >&2; exit 1; }
done
echo "restore-check: ok"
