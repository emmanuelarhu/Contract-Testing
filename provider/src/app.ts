// This is the REAL payment-service. In production it talks to a real DB.
// For Pact verification, we run it as-is and let Pact hit it with real HTTP requests.

import express, { Express } from 'express';

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  // The actual endpoint
  app.get('/payment-methods/:userId', (req, res) => {
    // In real life: query the database for this user's payment methods
    res.status(200).json([
      { id: 'pm_999', type: 'MOMO', provider: 'MTN', isDefault: true },
      { id: 'pm_998', type: 'CARD', provider: 'Visa', isDefault: false },
    ]);
  });

  // Pact uses this endpoint to set up "provider states"
  // before each interaction is verified
  app.post('/_pact/provider-states', (req, res) => {
    const { state } = req.body;
    console.log(`  → Setting up state: "${state}"`);
    // In real life: seed the DB so user 123 actually has payment methods
    res.status(200).json({ result: state });
  });

  return app;
}
