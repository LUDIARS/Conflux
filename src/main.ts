import { CcHttpClient } from './adapters/cc/cc-http-client.ts';
import { HttpCcBuildTriggerGateway } from './adapters/cc/cc-build-trigger-gateway.ts';
import { HttpCcHarnessGateway } from './adapters/cc/cc-harness-gateway.ts';
import { HttpCcIdentityGateway } from './adapters/cc/cc-identity-gateway.ts';
import { HttpCcProjectRegistry } from './adapters/cc/cc-project-registry.ts';
import { HttpCcSpawnGateway } from './adapters/cc/cc-spawn-gateway.ts';
import { composeDeps } from './adapters/compose.ts';
import { loadConfig } from './adapters/config/load-config.ts';
import { UnconfiguredDeployGateway } from './adapters/deploy/unconfigured-deploy-gateway.ts';
import { createApp } from './adapters/http/create-app.ts';
import { createNodeServer } from './adapters/http/node-server.ts';
import { JsonFileDatabase } from './adapters/storage/json-file-database.ts';
import { systemClock, uuidIds } from './shared/runtime.ts';

/**
 * Composition root. Not started by this change; running the service is a separate,
 * explicitly authorised step (Excubitor-managed).
 */
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const db = await JsonFileDatabase.open(config.dataDir);
  const client = new CcHttpClient({ baseUrl: config.ccBaseUrl, fetchImpl: fetch, timeoutMs: config.ccTimeoutMs });
  const deps = composeDeps(
    db,
    {
      registry: new HttpCcProjectRegistry(client),
      harness: new HttpCcHarnessGateway(client),
      spawner: new HttpCcSpawnGateway(client, {
        ...(config.ccSpawnPath ? { spawnPath: config.ccSpawnPath } : {}),
        ...(config.ccSpawnLookupPath ? { lookupPath: config.ccSpawnLookupPath } : {}),
      }),
      buildTrigger: new HttpCcBuildTriggerGateway(client, config.ccBuildPath),
      identity: new HttpCcIdentityGateway(client, config.ccIdentityPath),
      deployTarget: new UnconfiguredDeployGateway(),
    },
    { clock: systemClock, ids: uuidIds, hookToken: config.hookToken },
  );
  const server = createNodeServer(createApp(deps), (error) => {
    process.stderr.write(`[conflux] request failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  server.listen(config.port, config.host, () => {
    process.stderr.write(`[conflux] listening on http://${config.host}:${config.port}\n`);
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`[conflux] startup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
