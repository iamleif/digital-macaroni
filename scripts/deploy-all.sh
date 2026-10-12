#!/usr/bin/env bash
# Deploys everything at once: tests, the voice service, the website, then pushes git.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Tests"
(cd voice && uv run pytest -q)

echo "== Voice service"
(cd voice && gcloud run deploy studio-demo-voice --source . \
  --project digital-macaroni-510610 --region us-central1 --account leif@rankladder.app --quiet)

echo "== Website"
npm run deploy

echo "== Git"
git push

echo "== Live"
gcloud run services describe studio-demo-voice --project digital-macaroni-510610 --region us-central1 \
  --account leif@rankladder.app --format='value(status.latestReadyRevisionName)'
curl -s -o /dev/null -w "site %{http_code}\n" https://digitalmacaroni.io/
