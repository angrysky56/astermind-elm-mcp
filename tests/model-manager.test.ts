import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelManager } from '../src/model-manager.js';

describe('ModelManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('returns metadata snapshots that cannot mutate registered models', () => {
    const manager = new ModelManager();
    manager.createClassifier('safe-metadata', {
      categories: ['positive', 'negative'],
      useTokenizer: true,
      hiddenUnits: 8,
      log: { verbose: false },
    });

    const listed = manager.listModels();
    listed[0].id = 'mutated';
    listed[0].categories?.push('unexpected');

    expect(manager.getMetadata('safe-metadata')).toMatchObject({
      id: 'safe-metadata',
      categories: ['positive', 'negative'],
    });
  });

  it('does not allow metadata updates to change model identity or type', () => {
    const manager = new ModelManager();
    manager.createClassifier('identity', {
      categories: ['positive', 'negative'],
      useTokenizer: true,
      hiddenUnits: 8,
      log: { verbose: false },
    });

    expect(() => manager.updateMetadata('identity', { id: 'other' })).toThrow(
      'Model id and type are immutable',
    );
    expect(() => manager.updateMetadata('identity', { type: 'online' })).toThrow(
      'Model id and type are immutable',
    );
  });

  it('manages classifier, online, and embedding model lifecycles', () => {
    const manager = new ModelManager();
    manager.createClassifier('classifier', {
      categories: ['positive', 'negative'],
      useTokenizer: true,
      hiddenUnits: 8,
      log: { verbose: false },
    });
    manager.createOnlineModel('online', { inputDim: 2, outputDim: 2 });
    manager.createEmbeddingStore('embeddings', {
      dimension: 3,
      capacity: 10,
      storeUnit: true,
    });

    expect(manager.listModels().map(({ id, type }) => ({ id, type }))).toEqual([
      { id: 'classifier', type: 'classifier' },
      { id: 'online', type: 'online' },
      { id: 'embeddings', type: 'embedding' },
    ]);
    expect(() => manager.createEmbeddingStore('embeddings', { dimension: 3 })).toThrow(
      "Model 'embeddings' already exists",
    );
    expect(manager.deleteModel('online')).toBe(true);
    expect(manager.deleteModel('missing')).toBe(false);
    manager.clear();
    expect(manager.listModels()).toEqual([]);
  });

  it('updates last-used time when a model is retrieved', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const manager = new ModelManager();
    manager.createEmbeddingStore('timed', { dimension: 3 });

    vi.setSystemTime(new Date('2026-01-01T01:00:00Z'));
    manager.getModel('timed');

    expect(manager.getMetadata('timed').lastUsed).toEqual(new Date('2026-01-01T01:00:00Z'));
    expect(manager.hasModel('timed')).toBe(true);
    expect(() => manager.getModel('missing')).toThrow("Model 'missing' not found");
  });
});
