#!/usr/bin/env bash
# =============================================================================
# Register a webhook in the Pact Broker that triggers the provider's GitLab
# pipeline whenever a consumer publishes a new contract.
#
# This is the magic that makes Pact bidirectional:
#   Consumer publishes new pact → Broker fires webhook → Provider CI runs
#
# Run once per provider, after the broker is up.
# =============================================================================

set -euo pipefail

BROKER_URL="${PACT_BROKER_BASE_URL:-http://localhost:9292}"
BROKER_USER="${PACT_BROKER_USERNAME:-pact_user}"
BROKER_PASS="${PACT_BROKER_PASSWORD:-pact_password}"

# GitLab pipeline trigger details
# Get these from: GitLab repo → Settings → CI/CD → Pipeline triggers
GITLAB_PROJECT_ID="${GITLAB_PROJECT_ID:?Set GITLAB_PROJECT_ID}"
GITLAB_TRIGGER_TOKEN="${GITLAB_TRIGGER_TOKEN:?Set GITLAB_TRIGGER_TOKEN}"
GITLAB_API="${GITLAB_API:-https://gitlab.com/api/v4}"

PROVIDER_NAME="${PROVIDER_NAME:-payment-service}"

curl -X POST "$BROKER_URL/webhooks" \
  -u "$BROKER_USER:$BROKER_PASS" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "description": "Trigger ${PROVIDER_NAME} pipeline on contract change",
  "events": [
    { "name": "contract_requiring_verification_published" }
  ],
  "request": {
    "method": "POST",
    "url": "${GITLAB_API}/projects/${GITLAB_PROJECT_ID}/trigger/pipeline",
    "headers": { "Content-Type": "application/json" },
    "body": {
      "token": "${GITLAB_TRIGGER_TOKEN}",
      "ref": "main",
      "variables": {
        "TRIGGERED_BY_PACT_CHANGED": "true",
        "PACT_URL": "\${pactbroker.pactUrl}",
        "CONSUMER_NAME": "\${pactbroker.consumerName}",
        "CONSUMER_VERSION": "\${pactbroker.consumerVersionNumber}"
      }
    }
  },
  "provider": {
    "name": "${PROVIDER_NAME}"
  }
}
EOF

echo ""
echo "✅ Webhook registered. Consumer pact changes will now trigger ${PROVIDER_NAME}'s pipeline."
