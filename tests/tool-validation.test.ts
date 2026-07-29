import { describe, expect, it } from 'vitest';
import { validateToolArguments } from '../src/tool-validation.js';

const validTrainingData = [
  { text: 'good', label: 'positive' },
  { text: 'bad', label: 'negative' },
];

describe('tool argument validation', () => {
  it('rejects malformed classifier requests before model creation', () => {
    const invalidCases: Array<[Record<string, unknown>, string]> = [
      [
        { training_data: validTrainingData },
        'model_id must be a non-empty string',
      ],
      [
        {
          model_id: 'model',
          training_data: [{ text: '', label: 'positive' }, { text: 'bad', label: 'negative' }],
        },
        'training_data[0].text must be a non-empty string',
      ],
      [
        {
          model_id: 'model',
          training_data: [{ text: 'good', label: '' }, { text: 'bad', label: 'negative' }],
        },
        'training_data[0].label must be a non-empty string',
      ],
      [
        { model_id: 'model', training_data: validTrainingData, config: { hiddenUnits: 0 } },
        'config.hiddenUnits must be an integer between 1 and 2048',
      ],
      [
        { model_id: 'model', training_data: validTrainingData, config: { activation: 'bogus' } },
        'config.activation must be one of: relu, leakyrelu, sigmoid, tanh, linear, gelu',
      ],
      [
        { model_id: 'model', training_data: validTrainingData, config: { weightInit: 'bogus' } },
        'config.weightInit must be one of: uniform, xavier, he',
      ],
      [
        { model_id: 'model', training_data: validTrainingData, config: { ridgeLambda: 0 } },
        'config.ridgeLambda must be greater than 0',
      ],
      [
        { model_id: 'model', training_data: validTrainingData, config: { maxLen: 0 } },
        'config.maxLen must be an integer between 1 and 512',
      ],
      [
        { model_id: 'model', training_data: validTrainingData, config: { dropout: 1 } },
        'config.dropout must be between 0 (inclusive) and 1 (exclusive)',
      ],
    ];

    for (const [args, message] of invalidCases) {
      expect(() => validateToolArguments('train_classifier', args)).toThrow(message);
    }
  });

  it('enforces required identifiers and payloads for every tool', () => {
    const invalidCases: Array<[string, Record<string, unknown>, string]> = [
      ['predict', {}, 'model_id must be a non-empty string'],
      ['predict', { model_id: 'model' }, 'text must be a non-empty string'],
      ['generate_embedding', {}, 'model_id must be a non-empty string'],
      ['generate_embedding', { model_id: 'model' }, 'text must be a non-empty string'],
      ['delete_model', {}, 'model_id must be a non-empty string'],
      ['save_model', {}, 'model_id must be a non-empty string'],
      ['store_model_persistent', {}, 'model_id must be a non-empty string'],
      ['store_model_persistent', { model_id: 'model' }, 'version must be a non-empty string'],
      ['load_model_persistent', {}, 'model_id must be a non-empty string'],
      ['list_model_versions', {}, 'model_id must be a non-empty string'],
      ['store_training_dataset', {}, 'dataset_id must be a non-empty string'],
      [
        'store_training_dataset',
        { dataset_id: 'dataset' },
        'training_data must contain at least one example',
      ],
      ['load_training_dataset', {}, 'dataset_id must be a non-empty string'],
      ['get_model_metrics', {}, 'model_id must be a non-empty string'],
      ['get_confusion_matrix', {}, 'model_id must be a non-empty string'],
      ['detect_drift', {}, 'model_id must be a non-empty string'],
      [
        'detect_drift',
        { model_id: 'model' },
        'baseline_window must contain valid start and end dates',
      ],
      ['store_embeddings', {}, 'collection_name must be a non-empty string'],
      [
        'store_embeddings',
        { collection_name: 'collection' },
        'items must contain at least one embedding record',
      ],
      ['search_similar', {}, 'collection_name must be a non-empty string'],
      [
        'search_similar',
        { collection_name: 'collection' },
        'query_embedding must be a non-empty array of finite numbers',
      ],
    ];

    const errors = invalidCases.map(([name, args]) => {
      try {
        validateToolArguments(name, args);
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });

    expect(errors).toEqual(invalidCases.map(([, , message]) => message));
    expect(validateToolArguments('list_models', undefined)).toEqual({});
  });

  it('rejects malformed time windows, logging flags, and embedding records', () => {
    const invalidCases: Array<[string, Record<string, unknown>, string]> = [
      [
        'predict',
        { model_id: 'model', text: 'hello', log_prediction: 'yes' },
        'log_prediction must be a boolean',
      ],
      [
        'get_model_metrics',
        { model_id: 'model', time_range: { start: 'not-a-date', end: 'also-bad' } },
        'time_range must contain valid start and end dates',
      ],
      [
        'detect_drift',
        {
          model_id: 'model',
          baseline_window: { start: '2026-01-02', end: '2026-01-01' },
          current_window: { start: '2026-01-03', end: '2026-01-04' },
        },
        'baseline_window.start must not be after baseline_window.end',
      ],
      [
        'store_embeddings',
        { collection_name: 'items', items: [{}] },
        'items[0].item_id must be a non-empty string',
      ],
      [
        'store_embeddings',
        {
          collection_name: 'items',
          items: [{ item_id: 'one', text: 'hello', embedding: [0.1, Number.NaN] }],
        },
        'items[0].embedding must be a non-empty array of finite numbers',
      ],
      [
        'store_embeddings',
        {
          collection_name: 'items',
          items: [
            { item_id: 'one', text: 'hello', embedding: [0.1, 0.2] },
            { item_id: 'two', text: 'world', embedding: [0.1] },
          ],
        },
        'all item embeddings must have the same dimension',
      ],
      [
        'search_similar',
        { collection_name: 'items', query_embedding: [0.1], top_k: 0 },
        'top_k must be an integer between 1 and 100',
      ],
    ];

    const errors = invalidCases.map(([name, args]) => {
      try {
        validateToolArguments(name, args);
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });

    expect(errors).toEqual(invalidCases.map(([, , message]) => message));
  });
});
