# AsterMind-ELM MCP Quick Reference

## Setup

```bash
npm ci
npm run build
npm test
```

Configure an MCP client to run `node` with the absolute path to
`build/index.js`.

## Tools

| Area | Tools |
| --- | --- |
| Classification | `train_classifier`, `predict`, `generate_embedding` |
| Memory | `list_models`, `delete_model`, `save_model` |
| Persistence | `store_model_persistent`, `load_model_persistent`, `list_model_versions` |
| Datasets | `store_training_dataset`, `load_training_dataset` |
| Monitoring | `get_model_metrics`, `get_confusion_matrix`, `detect_drift` |
| Vectors | `store_embeddings`, `search_similar` |

`save_model` returns a summary; it does not persist or export the weight
matrices. `generate_embedding` returns a model-specific hidden-feature vector,
not a pretrained semantic embedding.

## Classifier defaults and bounds

| Setting | Default | Accepted values |
| --- | --- | --- |
| `hiddenUnits` | 128 | integer 1–2048 |
| `activation` | `relu` | `relu`, `leakyrelu`, `sigmoid`, `tanh`, `linear`, `gelu` |
| `weightInit` | `xavier` | `uniform`, `xavier`, `he` |
| `ridgeLambda` | `1e-6` | finite number greater than 0 |
| `maxLen` | 30 | integer 1–512 |
| `dropout` | 0 | 0 inclusive to 1 exclusive |

Training requires at least two non-empty examples spanning at least two labels.
Use more representative examples and evaluate on held-out data for real work.

## Persistence

Set `ENABLE_PERSISTENCE=true`, initialize the schema with `npm run init-db`,
and use the persistent tools explicitly. Set `LOG_PREDICTIONS=true` only when
storing raw input text is acceptable. A call can opt out with
`log_prediction: false`.

## Validation

```bash
npm run build
npm run test:coverage
```

Real SurrealDB tests are gated by `SURREALDB_TEST_URL`; see the main README.
