import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';

describe('stdio MCP transport', () => {
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
  });

  it('initializes and lists tools from the built server process', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['build/index.js'],
      cwd: process.cwd(),
      env: { ENABLE_PERSISTENCE: 'false' },
      stderr: 'pipe',
    });
    client = new Client(
      { name: 'astermind-elm-test', version: '1.0.0' },
      { capabilities: {} },
    );

    await client.connect(transport);
    const response = await client.listTools();

    expect(response.tools).toHaveLength(16);
    expect(response.tools.map((tool) => tool.name)).toContain('train_classifier');
  }, 10_000);

  it('keeps stdout protocol-clean while training and predicting', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['build/index.js'],
      cwd: process.cwd(),
      env: { ENABLE_PERSISTENCE: 'false' },
      stderr: 'pipe',
    });
    client = new Client(
      { name: 'astermind-elm-test', version: '1.0.0' },
      { capabilities: {} },
    );
    const protocolErrors: Error[] = [];
    client.onerror = (error) => protocolErrors.push(error);

    await client.connect(transport);
    const trained = await client.callTool({
      name: 'train_classifier',
      arguments: {
        model_id: 'stdio-classifier',
        training_data: [
          { text: 'good', label: 'positive' },
          { text: 'bad', label: 'negative' },
        ],
        config: { hiddenUnits: 8 },
      },
    });
    const predicted = await client.callTool({
      name: 'predict',
      arguments: { model_id: 'stdio-classifier', text: 'good', top_k: 2 },
    });

    expect(trained.isError).not.toBe(true);
    expect(predicted.isError).not.toBe(true);
    expect(protocolErrors).toEqual([]);
  }, 10_000);
});
