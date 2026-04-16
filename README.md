# Pact Demo + Broker + GitLab CI

Production-grade Pact contract testing setup with:

- ✅ Consumer + Provider TypeScript demo
- ✅ Self-hosted Pact Broker (Docker Compose)
- ✅ GitLab CI configs for both repos
- ✅ Webhook setup for bidirectional triggering
- ✅ `can-i-deploy` deployment gates
- ✅ Works in two modes: **local** (no broker) and **broker** (production)

## Prerequisites

- Node.js 18+
- Docker + Docker Compose (for broker)

## Quick Start (Local Mode — No Broker)

Same as the original demo. Runs end-to-end without any infrastructure.

```bash
cd consumer && npm install && npm run test:pact
cd ../provider && npm install && npm run test:pact
```

## Full Workflow with Broker

### Step 1: Start the Pact Broker

```bash
docker compose up -d

# Wait ~30 seconds for postgres + broker to start
docker compose logs -f pact-broker  # watch until "Listening on 0.0.0.0:9292"
```

Open the dashboard: **http://localhost:9292**
- Username: `pact_user`
- Password: `pact_password`

### Step 2: Generate + Publish Consumer Contracts

```bash
cd consumer
npm run test:pact      # Generate the pact JSON
npm run pact:publish   # Publish to broker
```

Refresh the dashboard. You should now see:
- **ussd-flow-engine** as a consumer
- **payment-service** as a provider
- A pact between them, marked "unverified"

### Step 3: Run Provider Verification Against the Broker

```bash
cd ../provider
npm run test:pact:broker
```

Refresh the dashboard. The pact is now marked **verified** ✅.

### Step 4: Check `can-i-deploy`

```bash
cd ../consumer
npm run can-i-deploy
# Output: "Computer says yes \o/"
```

### Step 5: Record a Deployment

```bash
DEPLOY_ENV=staging npm run record-deployment
```

The broker now knows what's running where. Future `can-i-deploy` checks use this.

### Step 6: Watch It Catch a Breaking Change

1. Open `provider/src/app.ts`
2. Rename `provider:` to `providerName:` on the two payment method lines
3. Re-run `npm run test:pact:broker` in provider dir → **fails** with clear error
4. Verification result is also published back to broker (visible in dashboard)
5. Restore the field, re-run, all green again

## Project Structure

```
pact-demo/
├── docker-compose.yml              # Pact Broker + Postgres
├── scripts/
│   └── register-webhook.sh         # Set up auto-trigger from broker → GitLab
├── consumer/                       # ussd-flow-engine
│   ├── src/paymentClient.ts
│   ├── tests/payment.pact.test.ts
│   ├── package.json
│   └── .gitlab-ci.yml              # ← Drop into your real consumer repo
├── provider/                       # payment-service
│   ├── src/app.ts
│   ├── tests/verify.pact.test.ts   # Auto-detects broker vs local mode
│   ├── package.json
│   └── .gitlab-ci.yml              # ← Drop into your real provider repo
└── pacts/                          # Local pact files (only used in local mode)
```

## GitLab CI Setup

The `.gitlab-ci.yml` files in `consumer/` and `provider/` are **production-ready** —
copy them into your real Cellulant repos as-is.

### Required GitLab Variables

In each repo: **Settings → CI/CD → Variables**

| Variable | Value | Flags |
|---|---|---|
| `PACT_BROKER_BASE_URL` | `https://pact-broker.cellulant.internal` | — |
| `PACT_BROKER_USERNAME` | (your broker username) | masked |
| `PACT_BROKER_PASSWORD` | (your broker password) | masked, protected |

### Pipeline Stages

**Consumer pipeline:**
```
test → contract (publish) → can-i-deploy → deploy → record-deployment
```

**Provider pipeline:**
```
test → contract (verify + publish results) → can-i-deploy → deploy → record-deployment
```

### Webhook for Bidirectional Triggering

The magic loop — when a consumer publishes a new contract, the provider's
pipeline runs automatically.

1. In your provider's GitLab repo: **Settings → CI/CD → Pipeline triggers** → add a new trigger
2. Copy the trigger token and project ID
3. Run the registration script:

```bash
export PACT_BROKER_BASE_URL=https://pact-broker.cellulant.internal
export PACT_BROKER_USERNAME=...
export PACT_BROKER_PASSWORD=...
export GITLAB_PROJECT_ID=12345
export GITLAB_TRIGGER_TOKEN=glpt-xxxxx
export PROVIDER_NAME=payment-service

./scripts/register-webhook.sh
```

Now: consumer publishes pact → broker fires webhook → provider pipeline runs → results published back. Fully automated.

## Deploying the Broker on Cellulant Kubernetes

The `docker-compose.yml` is the local equivalent of what you'd run on K8s.
For production at Cellulant:

1. Use the official Helm chart: https://github.com/pact-foundation/pact-broker-chart
2. Back it with managed Postgres (or your existing PG cluster)
3. Behind your VPN/internal load balancer (no public exposure)
4. Real secrets (not the demo passwords)
5. Backups for the Postgres volume — losing it = losing all contract history

## Troubleshooting

**"Connection refused" when publishing:**
Broker isn't ready. Wait 30s after `docker compose up` and check
`docker compose logs pact-broker` for "Listening on 0.0.0.0:9292".

**"401 Unauthorized" when publishing:**
Check `PACT_BROKER_USERNAME` and `PACT_BROKER_PASSWORD` env vars match
what's in `docker-compose.yml`.

**`can-i-deploy` says "no":**
Correct behavior! Means there's no verified contract for the version you're
trying to deploy. Either:
- The provider hasn't verified yet (wait for their pipeline), OR
- The contract changed and broke compatibility (fix it)

**Provider verification doesn't run when consumer publishes:**
Webhook isn't registered or is misconfigured. Check the broker's
**Webhooks** page in the UI for delivery logs.

## Cellulant-Specific Adaptations

For your actual Tingg services:

1. **Replace service names** in package.json scripts — `ussd-flow-engine` and
   `payment-service` should match your real GitLab project names.

2. **Replace `deploy.sh`** with your real deployment commands (likely
   `kubectl apply` against your Rancher/ZOD clusters).

3. **Add provider state setup** for real database seeding — see `app.ts`.
   In production, call your test data factory.

4. **Use a service account** for broker auth, not personal credentials.

5. **Tag pacts by environment** — useful when you have separate test/staging/prod
   broker entries.
