#!/usr/bin/env bash
# Structural SEO audit. Repeatable, no install deps beyond curl + standard unix.
# Usage: scripts/seo-audit.sh [base-url]
#   default base-url: https://www.iksi.app

set -u
BASE="${1:-https://www.iksi.app}"
APEX="${BASE/https:\/\/www./https://}"
UA_BROWSER="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
UA_GOOGLEBOT="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

fetch_browser() { curl -sS -A "$UA_BROWSER" --max-time 15 "$1"; }
fetch_googlebot() { curl -sS -A "$UA_GOOGLEBOT" --max-time 15 "$1"; }
status_code() { curl -sS -A "$UA_BROWSER" -o /dev/null -w '%{http_code}' --max-time 10 "$1"; }
redirect_target() { curl -sS -A "$UA_BROWSER" -o /dev/null -w '%{redirect_url}' --max-time 10 "$1"; }

row() { printf "  %-44s %s\n" "$1" "$2"; }
section() { printf "\n== %s ==\n" "$1"; }

echo "SEO audit — base: $BASE"
echo "timestamp: $(date -u +%FT%TZ)"

# --- Homepage HTML (browser) ---
HTML_BROWSER="$TMPDIR/home.browser.html"
fetch_browser "$BASE/" > "$HTML_BROWSER"
HTML_GOOGLEBOT="$TMPDIR/home.googlebot.html"
fetch_googlebot "$BASE/" > "$HTML_GOOGLEBOT"

section "Homepage meta presence (browser-rendered)"
row "title"               "$(grep -oE '<title[^>]*>[^<]+</title>' "$HTML_BROWSER" | head -1 | sed -E 's/<[^>]+>//g')"
row "meta description chars" "$(grep -oE '<meta[^>]*name="description"[^>]*>' "$HTML_BROWSER" | head -1 | sed -E 's/.*content="([^"]*)".*/\1/' | awk '{print length}')"
row "canonical link"      "$(grep -oE '<link[^>]*rel="canonical"[^>]*>' "$HTML_BROWSER" | head -1 | sed -E 's/.*href="([^"]*)".*/\1/')"
row "og:* tag count"      "$(grep -oE '<meta[^>]*property="og:[^"]*"' "$HTML_BROWSER" | wc -l | tr -d ' ')"
row "twitter:* tag count" "$(grep -oE '<meta[^>]*(name|property)="twitter:[^"]*"' "$HTML_BROWSER" | wc -l | tr -d ' ')"
row "og:image"            "$(grep -oE '<meta[^>]*property="og:image"[^>]*content="[^"]+"' "$HTML_BROWSER" | head -1 | sed -E 's/.*content="([^"]+)".*/\1/')"
row "JSON-LD block count" "$(grep -oE '<script[^>]*type="application/ld\+json"' "$HTML_BROWSER" | wc -l | tr -d ' ')"

section "Crawlability parity (Googlebot vs browser)"
BROWSER_LEN=$(wc -c < "$HTML_BROWSER" | tr -d ' ')
GOOGLEBOT_LEN=$(wc -c < "$HTML_GOOGLEBOT" | tr -d ' ')
row "browser HTML bytes"      "$BROWSER_LEN"
row "googlebot HTML bytes"    "$GOOGLEBOT_LEN"
if [ "$BROWSER_LEN" = "$GOOGLEBOT_LEN" ]; then
  row "parity"                "exact match"
else
  DIFF=$(( BROWSER_LEN - GOOGLEBOT_LEN ))
  row "parity"                "differ by ${DIFF} bytes — investigate"
fi

section "Sitemap"
SITEMAP_URL="$BASE/sitemap.xml"
SITEMAP_BODY="$TMPDIR/sitemap.xml"
SITEMAP_STATUS=$(curl -sS -A "$UA_BROWSER" -o "$SITEMAP_BODY" -w '%{http_code}' --max-time 10 "$SITEMAP_URL")
row "GET $SITEMAP_URL"        "HTTP $SITEMAP_STATUS"
if [ "$SITEMAP_STATUS" = "200" ]; then
  URL_COUNT=$(grep -oE '<loc>[^<]+</loc>' "$SITEMAP_BODY" | wc -l | tr -d ' ')
  row "url count"             "$URL_COUNT"
  WRONG_HOST=$(grep -oE '<loc>[^<]+</loc>' "$SITEMAP_BODY" | grep -cE 'vercel\.app' || true)
  row "vercel.app urls (bad)" "$WRONG_HOST"
  CORRECT_HOST=$(grep -oE '<loc>[^<]+</loc>' "$SITEMAP_BODY" | grep -cE "${BASE#https://}" || true)
  row "urls on canonical host" "$CORRECT_HOST"
fi

section "robots.txt"
ROBOTS_URL="$BASE/robots.txt"
ROBOTS_BODY="$TMPDIR/robots.txt"
ROBOTS_STATUS=$(curl -sS -A "$UA_BROWSER" -o "$ROBOTS_BODY" -w '%{http_code}' --max-time 10 "$ROBOTS_URL")
row "GET $ROBOTS_URL"         "HTTP $ROBOTS_STATUS"
if [ "$ROBOTS_STATUS" = "200" ]; then
  SITEMAP_REF=$(grep -iE '^sitemap:' "$ROBOTS_BODY" | head -1 | sed -E 's/^[Ss]itemap:[[:space:]]*//')
  row "sitemap reference"     "${SITEMAP_REF:-<none>}"
  if echo "$SITEMAP_REF" | grep -q 'vercel.app'; then
    row "sitemap host"        "WRONG (points to vercel.app)"
  elif echo "$SITEMAP_REF" | grep -q "${BASE#https://}"; then
    row "sitemap host"        "ok"
  fi
  DISALLOWS=$(grep -ciE '^disallow:[[:space:]]*/' "$ROBOTS_BODY" || true)
  row "active Disallow rules" "$DISALLOWS"
fi

section "Domain hygiene"
APEX_STATUS=$(status_code "$APEX/")
APEX_REDIRECT=$(redirect_target "$APEX/")
row "apex ($APEX) status"     "HTTP $APEX_STATUS"
row "apex redirect target"    "${APEX_REDIRECT:-<none>}"
if [ "$APEX_STATUS" = "301" ] || [ "$APEX_STATUS" = "308" ]; then
  if echo "$APEX_REDIRECT" | grep -q "$BASE"; then
    row "apex → canonical"    "ok"
  else
    row "apex → canonical"    "WRONG target"
  fi
elif [ "$APEX_STATUS" = "200" ]; then
  row "apex → canonical"      "NO REDIRECT (duplicate content risk)"
fi

VERCEL_HOST="https://iksi.vercel.app"
VERCEL_STATUS=$(status_code "$VERCEL_HOST/")
row "vercel.app fallback"     "HTTP $VERCEL_STATUS"
if [ "$VERCEL_STATUS" = "200" ]; then
  row "vercel.app → canonical" "NO REDIRECT (duplicate content; fix in Vercel dashboard)"
elif [ "$VERCEL_STATUS" = "301" ] || [ "$VERCEL_STATUS" = "308" ]; then
  row "vercel.app → canonical" "ok"
fi

section "Slug route (sample) — short-link SEO behavior"
SAMPLE_SLUG="bUZXGWk"
SLUG_STATUS=$(status_code "$BASE/$SAMPLE_SLUG")
SLUG_TARGET=$(redirect_target "$BASE/$SAMPLE_SLUG")
row "GET /$SAMPLE_SLUG status" "HTTP $SLUG_STATUS"
if [ -n "$SLUG_TARGET" ]; then
  row "redirect target host"  "$(echo "$SLUG_TARGET" | sed -E 's|^https?://([^/]+)/.*|\1|')"
fi

section "Out-of-band KPIs (require external setup)"
cat <<EOF
  These cannot be measured by this script. To track real SEO outcomes:
    - Google Search Console: verify $BASE, submit sitemap, watch Impressions/
      Average Position/CTR over 4-6 weeks.
    - Lighthouse SEO score: in Chrome DevTools > Lighthouse > SEO only.
    - Rich Results Test: https://search.google.com/test/rich-results?url=$BASE
    - PageSpeed Insights: https://pagespeed.web.dev/analysis?url=$BASE

EOF
