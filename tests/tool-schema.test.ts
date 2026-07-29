import { describe, expect, it } from 'vitest';
import { TOOLS } from '../src/index.js';

describe('MCP tool schemas', () => {
  it('advertises the complete tool set with bounded classifier inputs', () => {
    expect(TOOLS.map((tool) => tool.name)).toEqual([
      'train_classifier',
      'predict',
      'generate_embedding',
      'list_models',
      'delete_model',
      'save_model',
      'store_model_persistent',
      'load_model_persistent',
      'list_model_versions',
      'store_training_dataset',
      'load_training_dataset',
      'get_model_metrics',
      'get_confusion_matrix',
      'detect_drift',
      'store_embeddings',
      'search_similar',
    ]);

    const train = TOOLS.find((tool) => tool.name === 'train_classifier');
    const properties = train?.inputSchema.properties as Record<string, any>;
    const config = properties.config.properties as Record<string, any>;
    expect(properties.model_id).toMatchObject({ type: 'string', minLength: 1 });
    expect(properties.training_data).toMatchObject({ type: 'array', minItems: 2 });
    expect(config.hiddenUnits).toMatchObject({ type: 'integer', minimum: 1, maximum: 2048 });
    expect(config.activation.enum).toEqual(['relu', 'leakyrelu', 'sigmoid', 'tanh', 'linear', 'gelu']);
    expect(config.weightInit.enum).toEqual(['uniform', 'xavier', 'he']);
    expect(config.ridgeLambda).toMatchObject({ type: 'number', exclusiveMinimum: 0 });
    expect(config.maxLen).toMatchObject({ type: 'integer', minimum: 1, maximum: 512 });
    expect(config.dropout).toMatchObject({ type: 'number', minimum: 0, exclusiveMaximum: 1 });

    const predict = TOOLS.find((tool) => tool.name === 'predict');
    const predictionProperties = predict?.inputSchema.properties as Record<string, any>;
    expect(predictionProperties.top_k).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 100,
    });

    const storeEmbeddings = TOOLS.find((tool) => tool.name === 'store_embeddings');
    const storeProperties = storeEmbeddings?.inputSchema.properties as Record<string, any>;
    expect(storeProperties.collection_name).toMatchObject({ type: 'string', minLength: 1 });
    expect(storeProperties.items).toMatchObject({ type: 'array', minItems: 1 });
    expect(storeProperties.items.items.properties.item_id).toMatchObject({ type: 'string', minLength: 1 });
    expect(storeProperties.items.items.properties.text).toMatchObject({ type: 'string', minLength: 1 });
    expect(storeProperties.items.items.properties.embedding).toMatchObject({ type: 'array', minItems: 1 });

    const search = TOOLS.find((tool) => tool.name === 'search_similar');
    const searchProperties = search?.inputSchema.properties as Record<string, any>;
    expect(searchProperties.collection_name).toMatchObject({ type: 'string', minLength: 1 });
    expect(searchProperties.query_embedding).toMatchObject({ type: 'array', minItems: 1 });
    expect(searchProperties.top_k).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 5,
    });
  });
});
