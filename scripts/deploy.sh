#!/usr/bin/env bash
# Ship the nb web server to stockholm. There is no CI, so the tests run here
# and nothing is copied if they fail.
set -euo pipefail
cd "$(dirname "$0")/.."

# Must match the image in the OMV stack `nb`, so install and runtime use one Node.
IMAGE=node:24-alpine

npm test
scripts/vendor-feathers.sh
ssh stockholm 'mkdir -p apps/nb'
rsync -a --delete lib web server.js package.json package-lock.json stockholm:apps/nb/

# The container mounts the token file instead of ~/.secrets.privileged.env, which holds
# unrelated secrets. Rewriting the file on every deploy picks up a rotated token.
ssh stockholm 'bash -s' <<'EOF'
set -euo pipefail
umask 077
mkdir -p ~/.config/nb
source ~/.secrets.privileged.env
test -n "$INFLUX_WRITE_TOKEN"
printf %s "$INFLUX_WRITE_TOKEN" > ~/.config/nb/influx-write-token
EOF

# /app is read-only in the app container, so the install runs in a throwaway one.
# shellcheck disable=SC2029
ssh stockholm "docker run --rm -v /home/pi/apps/nb:/app -w /app $IMAGE npm ci --omit=dev"

ssh stockholm 'if docker inspect nb >/dev/null 2>&1; then docker restart nb >/dev/null; sleep 3; docker exec nb node -e "fetch(\"http://127.0.0.1:8080/healthz\").then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)}).catch(e=>{console.error(e.message);process.exit(1)})"; fi'
