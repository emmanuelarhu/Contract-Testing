#!/usr/bin/env node
/**
 * Cross-platform wrapper for pact-broker CLI commands.
 *
 * Avoids two issues:
 *   1. The npm @pact-foundation/pact-cli package is broken on Windows (Ruby bundling bug)
 *   2. ${VAR:-default} bash syntax doesn't work in Windows shells
 *
 * Uses the official Docker image instead, which works identically everywhere.
 *
 * Requires Docker Desktop (Windows/Mac) or Docker Engine (Linux) to be running.
 *
 * Usage:
 *   node scripts/pact-broker.js publish
 *   node scripts/pact-broker.js can-i-deploy
 *   node scripts/pact-broker.js record-deployment
 */

const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

// ─── Config (with sensible defaults) ───
const env = {
  GIT_SHA: process.env.GIT_SHA || '1.0.0',
  GIT_BRANCH: process.env.GIT_BRANCH || 'local',
  PACT_BROKER_BASE_URL: process.env.PACT_BROKER_BASE_URL || 'http://host.docker.internal:9292',
  PACT_BROKER_USERNAME: process.env.PACT_BROKER_USERNAME || 'pact_user',
  PACT_BROKER_PASSWORD: process.env.PACT_BROKER_PASSWORD || 'pact_password',
  DEPLOY_ENV: process.env.DEPLOY_ENV || 'staging',
  PACTICIPANT: process.env.PACTICIPANT || 'ussd-flow-engine',
};

// ─── Map command to Docker invocation ───
const command = process.argv[2];

const consumerRoot = path.resolve(__dirname, '..');
const pactsDir = path.join(consumerRoot, 'pacts');

// Mount the pacts dir into the container so the CLI can read it
const dockerBase = [
  'run', '--rm',
  '-v', `${pactsDir}:/pacts`,
  // Lets the container reach the broker on host (Docker Desktop maps host.docker.internal automatically)
  '--add-host', 'host.docker.internal:host-gateway',
  '-e', `PACT_BROKER_BASE_URL=${env.PACT_BROKER_BASE_URL}`,
  '-e', `PACT_BROKER_USERNAME=${env.PACT_BROKER_USERNAME}`,
  '-e', `PACT_BROKER_PASSWORD=${env.PACT_BROKER_PASSWORD}`,
  'pactfoundation/pact-cli:latest',
];

let cliArgs;

switch (command) {
  case 'publish':
    cliArgs = [
      'pact-broker', 'publish', '/pacts',
      `--consumer-app-version=${env.GIT_SHA}`,
      `--branch=${env.GIT_BRANCH}`,
    ];
    break;

  case 'can-i-deploy':
    cliArgs = [
      'pact-broker', 'can-i-deploy',
      `--pacticipant=${env.PACTICIPANT}`,
      `--version=${env.GIT_SHA}`,
      `--to-environment=${env.DEPLOY_ENV}`,
    ];
    break;

  case 'record-deployment':
    cliArgs = [
      'pact-broker', 'record-deployment',
      `--pacticipant=${env.PACTICIPANT}`,
      `--version=${env.GIT_SHA}`,
      `--environment=${env.DEPLOY_ENV}`,
    ];
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Usage: node scripts/pact-broker.js <publish|can-i-deploy|record-deployment>');
    process.exit(1);
}

const fullArgs = [...dockerBase, ...cliArgs];

console.log(`→ docker ${fullArgs.join(' ')}`);
console.log('');

const result = spawnSync('docker', fullArgs, { stdio: 'inherit' });

if (result.error) {
  console.error('');
  console.error('❌ Failed to run docker. Is Docker Desktop running?');
  console.error('   Error:', result.error.message);
  process.exit(1);
}

process.exit(result.status || 0);