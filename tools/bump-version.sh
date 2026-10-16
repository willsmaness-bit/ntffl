#!/usr/bin/env bash
# Usage: tools/bump-version.sh 15
# Sets one cache-bust ?v= value across every page and js/league.js.
set -euo pipefail
v="${1:?new version number}"
cd "$(dirname "$0")/.."
sed -i -E "s/\?v=[0-9]+/?v=${v}/g" *.html
sed -i -E "s/cacheVersion: [0-9]+/cacheVersion: ${v}/" js/league.js
grep -ho '?v=[0-9]*' *.html | sort | uniq -c
