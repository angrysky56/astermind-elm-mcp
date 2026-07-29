export type ToolArguments = Record<string, unknown>;

function isRecord(value: unknown): value is ToolArguments {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function validateClassifierConfig(value: unknown): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error('config must be an object');

  if (value.hiddenUnits !== undefined
    && (!Number.isInteger(value.hiddenUnits) || (value.hiddenUnits as number) < 1 || (value.hiddenUnits as number) > 2048)) {
    throw new Error('config.hiddenUnits must be an integer between 1 and 2048');
  }

  const activations = ['relu', 'leakyrelu', 'sigmoid', 'tanh', 'linear', 'gelu'];
  if (value.activation !== undefined && !activations.includes(value.activation as string)) {
    throw new Error(`config.activation must be one of: ${activations.join(', ')}`);
  }

  const initializers = ['uniform', 'xavier', 'he'];
  if (value.weightInit !== undefined && !initializers.includes(value.weightInit as string)) {
    throw new Error(`config.weightInit must be one of: ${initializers.join(', ')}`);
  }

  if (value.ridgeLambda !== undefined
    && (typeof value.ridgeLambda !== 'number' || !Number.isFinite(value.ridgeLambda) || value.ridgeLambda <= 0)) {
    throw new Error('config.ridgeLambda must be greater than 0');
  }

  if (value.maxLen !== undefined
    && (!Number.isInteger(value.maxLen) || (value.maxLen as number) < 1 || (value.maxLen as number) > 512)) {
    throw new Error('config.maxLen must be an integer between 1 and 512');
  }

  if (value.dropout !== undefined
    && (typeof value.dropout !== 'number' || !Number.isFinite(value.dropout) || value.dropout < 0 || value.dropout >= 1)) {
    throw new Error('config.dropout must be between 0 (inclusive) and 1 (exclusive)');
  }
}

function requireTrainingExamples(value: unknown): Array<ToolArguments> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('training_data must contain at least one example');
  }

  return value.map((example, index) => {
    if (!isRecord(example)) {
      throw new Error(`training_data[${index}] must be an object`);
    }
    requireNonEmptyString(example.text, `training_data[${index}].text`);
    requireNonEmptyString(example.label, `training_data[${index}].label`);
    return example;
  });
}

function requireDateWindow(value: unknown, path: string): void {
  if (!isRecord(value)
    || typeof value.start !== 'string'
    || typeof value.end !== 'string'
    || !Number.isFinite(Date.parse(value.start))
    || !Number.isFinite(Date.parse(value.end))) {
    throw new Error(`${path} must contain valid start and end dates`);
  }
  if (Date.parse(value.start) > Date.parse(value.end)) {
    throw new Error(`${path}.start must not be after ${path}.end`);
  }
}

function requireNumberVector(value: unknown, path: string): number[] {
  if (!Array.isArray(value)
    || value.length === 0
    || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    throw new Error(`${path} must be a non-empty array of finite numbers`);
  }
  return value;
}

export function validateToolArguments(name: string, value: unknown): ToolArguments {
  const args = value ?? {};
  if (!isRecord(args)) {
    throw new Error('tool arguments must be an object');
  }

  const validated = args;

  const modelIdTools = new Set([
    'train_classifier',
    'predict',
    'generate_embedding',
    'delete_model',
    'save_model',
    'store_model_persistent',
    'load_model_persistent',
    'list_model_versions',
    'get_model_metrics',
    'get_confusion_matrix',
    'detect_drift',
  ]);
  if (modelIdTools.has(name)) {
    requireNonEmptyString(validated.model_id, 'model_id');
  }

  if (name === 'train_classifier') {
    const trainingData = requireTrainingExamples(validated.training_data);
    const labels = new Set(trainingData.map((example) => example.label as string));
    if (labels.size < 2) {
      throw new Error('training_data must contain at least two distinct labels');
    }
    validateClassifierConfig(validated.config);
  }

  if (name === 'predict') {
    requireNonEmptyString(validated.text, 'text');
    if (validated.log_prediction !== undefined && typeof validated.log_prediction !== 'boolean') {
      throw new Error('log_prediction must be a boolean');
    }
  }
  if (name === 'generate_embedding') {
    requireNonEmptyString(validated.text, 'text');
  }
  if (name === 'store_model_persistent') {
    requireNonEmptyString(validated.version, 'version');
  }
  if (name === 'store_training_dataset') {
    requireNonEmptyString(validated.dataset_id, 'dataset_id');
    requireTrainingExamples(validated.training_data);
  }
  if (name === 'load_training_dataset') {
    requireNonEmptyString(validated.dataset_id, 'dataset_id');
  }
  if (name === 'detect_drift') {
    requireDateWindow(validated.baseline_window, 'baseline_window');
    requireDateWindow(validated.current_window, 'current_window');
  }
  if ((name === 'get_model_metrics' || name === 'get_confusion_matrix')
    && validated.time_range !== undefined) {
    requireDateWindow(validated.time_range, 'time_range');
  }
  if (name === 'store_embeddings') {
    requireNonEmptyString(validated.collection_name, 'collection_name');
    if (!Array.isArray(validated.items) || validated.items.length === 0) {
      throw new Error('items must contain at least one embedding record');
    }
    let dimension: number | undefined;
    validated.items.forEach((item, index) => {
      if (!isRecord(item)) throw new Error(`items[${index}] must be an object`);
      requireNonEmptyString(item.item_id, `items[${index}].item_id`);
      requireNonEmptyString(item.text, `items[${index}].text`);
      const embedding = requireNumberVector(item.embedding, `items[${index}].embedding`);
      dimension ??= embedding.length;
      if (embedding.length !== dimension) {
        throw new Error('all item embeddings must have the same dimension');
      }
    });
  }
  if (name === 'search_similar') {
    requireNonEmptyString(validated.collection_name, 'collection_name');
    requireNumberVector(validated.query_embedding, 'query_embedding');
  }

  if ((name === 'predict' || name === 'search_similar') && validated.top_k !== undefined) {
    const topK = validated.top_k;
    if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 100) {
      throw new Error('top_k must be an integer between 1 and 100');
    }
  }

  return validated;
}
