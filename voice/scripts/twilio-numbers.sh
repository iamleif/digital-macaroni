#!/usr/bin/env bash
# Points the two demo numbers at studio-demo-voice, or restores their previous RankLadder settings.
#   scripts/twilio-numbers.sh point     # after deploy.sh has succeeded
#   scripts/twilio-numbers.sh restore   # back to rankladder-bridge, as recorded on 2026-10-03
# Only the incoming-call (voice) settings of these two numbers change. Uses the demo-only API key.
set -euo pipefail

PROJECT=rankladder-471812
service_url() { gcloud run services describe "$1" --project "$PROJECT" --region us-central1 --format='value(status.url)'; }
DEMO_URL=$(service_url studio-demo-voice)
BRIDGE_URL=$(service_url rankladder-bridge)
NORTHLINE=PNc357875b63682285ee17068e1057d137  # +1 206 887 9619
FORMFIELD=PN7d2dd7a1d920b9c3786e6b0e70298a32  # +1 830 239 2110

secret() { gcloud secrets versions access latest --secret="$1" --project "$PROJECT"; }
AC=$(secret studio-demo-twilio-account-sid)
AUTH="$(secret studio-demo-twilio-api-key-sid):$(secret studio-demo-twilio-api-key-secret)"

update() {
  curl -fsS -u "$AUTH" "https://api.twilio.com/2010-04-01/Accounts/$AC/IncomingPhoneNumbers/$1.json" \
    --data-urlencode "VoiceUrl=$2" -d VoiceMethod=POST --data-urlencode "StatusCallback=$3" -d StatusCallbackMethod=POST \
    | python3 -c "import sys,json; n=json.load(sys.stdin); print(n['phone_number'], '→', n['voice_url'], '| status:', n['status_callback'] or '-')"
}

case "${1:-}" in
  point)
    curl -fsS "$DEMO_URL/health" >/dev/null || { echo "studio-demo-voice is not answering; deploy it first." >&2; exit 1; }
    update "$NORTHLINE" "$DEMO_URL/twilio/voice" ""
    update "$FORMFIELD" "$DEMO_URL/twilio/voice" ""
    ;;
  restore)
    update "$NORTHLINE" "$BRIDGE_URL/twilio/voice" "$BRIDGE_URL/twilio/voice-status"
    update "$FORMFIELD" "$BRIDGE_URL/twilio/voice" "$BRIDGE_URL/twilio/voice-status"
    ;;
  *) echo "usage: $0 point|restore" >&2; exit 2 ;;
esac
