#!/usr/bin/env bash
# Cheap integrity check for a pg_dump custom-format archive: pg_restore must
# be able to read its table of contents. Catches truncated or corrupt dumps
# every night without a full restore.
# Usage: check-archive.sh <file.dump>
set -euo pipefail

dump="${1:?usage: check-archive.sh <file.dump>}"
[ -s "$dump" ] || { echo "check-archive: $dump is missing or empty" >&2; exit 1; }

dir="$(cd "$(dirname "$dump")" && pwd)"
if ! docker run --rm -v "$dir:/in:ro" postgres:17 \
	pg_restore --list "/in/$(basename "$dump")" >/dev/null; then
	echo "check-archive: $dump is not a readable pg_dump archive" >&2
	exit 1
fi
echo "check-archive: ok"
