// Provider verification — broker-aware version.
//
// Behavior depends on env vars:
//   - If PACT_BROKER_BASE_URL is set → pulls contracts from broker, publishes results back
//   - Otherwise → falls back to local pact file (for offline/dev use)

import { Verifier } from '@pact-foundation/pact';
import { createApp } from '../src/app';
import { Server } from 'http';
import path from 'path';

describe('Payment Service Provider Verification', () => {
  let server: Server;
  const PORT = 8888;

  beforeAll((done) => {
    server = createApp().listen(PORT, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  it('honors all consumer contracts', async () => {
    const useBroker = process.env.PACT_BROKER_BASE_URL !== undefined;

    const baseConfig = {
      providerBaseUrl: `http://localhost:${PORT}`,
      provider: 'payment-service',
      providerVersion: process.env.GIT_SHA || '1.0.0',
      providerVersionBranch: process.env.GIT_BRANCH || 'local',
      providerStatesSetupUrl: `http://localhost:${PORT}/_pact/provider-states`,
      logLevel: 'warn' as const,
    };

    const config = useBroker
      ? {
          ...baseConfig,
          // ─── Broker mode (production CI) ───
          pactBrokerUrl: process.env.PACT_BROKER_BASE_URL,
          pactBrokerUsername: process.env.PACT_BROKER_USERNAME,
          pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
          publishVerificationResult: process.env.CI === 'true',
          consumerVersionSelectors: [
            { mainBranch: true },          // Latest contract from each consumer's main branch
            { deployedOrReleased: true },  // Whatever's actually live in any environment
            { matchingBranch: true },      // Same branch name as provider (for parallel feature work)
          ],
        }
      : {
          ...baseConfig,
          // ─── Local mode (offline dev) ───
          pactUrls: [
            path.resolve(process.cwd(), '../pacts/ussd-flow-engine-payment-service.json'),
          ],
        };

    await new Verifier(config).verifyProvider();
  });
});
