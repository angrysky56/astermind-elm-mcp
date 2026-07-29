import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';

const databaseUrl = process.env.SURREALDB_TEST_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

function readJson(result: unknown): Record<string, any> {
  if (typeof result !== 'object' || result === null || !('content' in result)) {
    throw new Error('Expected a tool result with content');
  }
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((item) => item.type === 'text')?.text;
  if (!text) throw new Error('Expected a text tool result');
  return JSON.parse(text) as Record<string, any>;
}

describeIntegration('stdio MCP persistence workflow', () => {
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
  });

  it('persists, reloads, predicts, logs, and reports metrics through MCP', async () => {
    const modelId = `stdio-persistent-${Date.now()}`;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['build/index.js'],
      cwd: process.cwd(),
      env: {
        ENABLE_PERSISTENCE: 'true',
        LOG_PREDICTIONS: 'false',
        SURREALDB_URL: databaseUrl!,
        SURREALDB_NAMESPACE: process.env.SURREALDB_TEST_NAMESPACE ?? 'astermind_test',
        SURREALDB_DATABASE: process.env.SURREALDB_TEST_DATABASE ?? 'integration',
        SURREALDB_USERNAME: process.env.SURREALDB_TEST_USERNAME ?? 'root',
        SURREALDB_PASSWORD: process.env.SURREALDB_TEST_PASSWORD ?? 'root',
      },
      stderr: 'pipe',
    });
    client = new Client(
      { name: 'astermind-elm-persistence-test', version: '1.0.0' },
      { capabilities: {} },
    );

    await client.connect(transport);
    const trained = await client.callTool({
      name: 'train_classifier',
      arguments: {
        model_id: modelId,
        training_data: [
          { text: 'a-b', label: 'dashed' },
          { text: 'ab', label: 'plain' },
        ],
        config: { hiddenUnits: 32, maxLen: 8 },
        persist: true,
        version: '1.0.0',
      },
    });
    expect(readJson(trained)).toMatchObject({
      success: true,
      model_id: modelId,
      persisted: true,
      version: '1.0.0',
    });

    await client.callTool({ name: 'delete_model', arguments: { model_id: modelId } });
    const loaded = await client.callTool({
      name: 'load_model_persistent',
      arguments: { model_id: modelId, version: '1.0.0' },
    });
    expect(readJson(loaded)).toMatchObject({ success: true, model_id: modelId, version: '1.0.0' });

    const predicted = await client.callTool({
      name: 'predict',
      arguments: {
        model_id: modelId,
        text: 'a-b',
        top_k: 1,
        log_prediction: true,
        ground_truth: 'dashed',
      },
    });
    expect(readJson(predicted).predictions[0].category).toBe('dashed');

    const metrics = readJson(await client.callTool({
      name: 'get_model_metrics',
      arguments: { model_id: modelId },
    }));
    expect(metrics.metrics).toMatchObject({
      accuracy: 1,
      total_predictions: 1,
      predictions_per_label: { dashed: 1 },
    });
  }, 15_000);
});
