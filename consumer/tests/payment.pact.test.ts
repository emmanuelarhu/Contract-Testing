// THIS IS THE CONTRACT TEST.
// It does 3 things:
//   1. Spins up a fake Pact mock provider on a local port
//   2. Tells Pact: "When my code calls X, you should respond with Y"
//   3. Runs the real client code against the mock; if it works, a contract file is generated

import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { PaymentClient } from '../src/paymentClient';
import path from 'path';

const { like, eachLike, string, boolean } = MatchersV3;

// Define the Pact: who is the consumer, who is the provider, where to save contracts
const provider = new PactV3({
  consumer: 'ussd-flow-engine',
  provider: 'payment-service',
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('Payment Service Contract', () => {
  it('returns a list of payment methods for a user', async () => {
    // ============================================================
    // ARRANGE: Define the interaction — what we expect from provider
    // ============================================================
    provider
      .given('user 123 has registered payment methods')   // Provider state
      .uponReceiving('a request for user 123 payment methods')
      .withRequest({
        method: 'GET',
        path: '/payment-methods/123',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        // KEY POINT: We don't pin to specific values.
        // We say "an array of at least 1 item, where each item has these field types"
        body: eachLike({
          id: string('pm_001'),         // example value, but MUST be a string
          type: string('MOMO'),
          provider: string('MTN'),
          isDefault: boolean(true),
        }),
      });

    // ============================================================
    // ACT + ASSERT: Run the real client against Pact's mock server
    // ============================================================
    await provider.executeTest(async (mockServer) => {
      const client = new PaymentClient(mockServer.url);
      const result = await client.getPaymentMethods('123');

      // Normal Jest assertions on the client's behavior
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pm_001');
      expect(result[0].type).toBe('MOMO');
    });

    // If we reach here without errors, Pact writes:
    //   pacts/ussd-flow-engine-payment-service.json
  });
});
