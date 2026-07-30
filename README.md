# AsterMind-ELM MCP Server

A local Model Context Protocol server for training small text classifiers with
Extreme Learning Machines (ELMs). It supports in-memory inference and optional
SurrealDB persistence, prediction monitoring, and vector storage.

## Is it useful?

Yes, for focused classification tasks where data must stay under your control
and rapid retraining matters. Good candidates include intent routing, spam or
content categorization, support-ticket triage, and lightweight labeling aids.

It is not a general semantic-search model or a production ML platform. The
`generate_embedding` tool exposes a trained ELM's task-specific hidden features;
it does not use a pretrained language model and should not be described as a
semantic embedding without evaluation on the intended corpus.

## Capabilities

- Train multi-class text classifiers from labeled examples.
- Predict labels and return ranked confidence scores.
- Generate model-specific hidden-feature vectors.
- Keep multiple models in memory and inspect their metadata.
- Optionally store and reload versioned models and datasets in SurrealDB.
- Optionally log predictions and calculate accuracy, latency, label counts, a
  confusion matrix, and distribution drift.
- Store arbitrary equal-dimension vectors and search them with cosine
  similarity.

The server exposes 16 MCP tools:

- Core: `train_classifier`, `predict`, `generate_embedding`, `list_models`,
  `delete_model`, `save_model`
- Persistence: `store_model_persistent`, `load_model_persistent`,
  `list_model_versions`, `store_training_dataset`, `load_training_dataset`
- Monitoring: `get_model_metrics`, `get_confusion_matrix`, `detect_drift`
- Vector storage: `store_embeddings`, `search_similar`

`save_model` returns an in-memory summary. Use `store_model_persistent` when a
model must survive a restart.

## Requirements

- Node.js 20.19+ or 22.12+
- SurrealDB only when persistence is enabled

## Install, build, and test

```bash
npm ci
npm run build
npm test
```

Additional commands:

```bash
npm run test:watch
npm run test:coverage
npm run watch
```

Coverage is enforced for the production TypeScript at 80% statements, 65%
branches, 80% functions, and 80% lines. CI runs the locked dependency set on
current Node.js 20, 22, and 24 releases, plus the persistence suite against a
disposable SurrealDB service on Node.js 24.

## MCP configuration

Build first, then point an MCP client at the compiled stdio entry point:

```json
{
  "mcpServers": {
    "astermind-elm": {
      "command": "node",
      "args": ["/absolute/path/to/astermind-elm-mcp/build/index.js"]
    }
  }
}
```

The server writes protocol messages to stdout and diagnostics to stderr.

## Minimal workflow

Call `train_classifier`:

```json
{
  "model_id": "sentiment",
  "training_data": [
    { "text": "excellent purchase", "label": "positive" },
    { "text": "love this product", "label": "positive" },
    { "text": "terrible purchase", "label": "negative" },
    { "text": "hate this product", "label": "negative" }
  ],
  "config": {
    "hiddenUnits": 128,
    "activation": "relu"
  }
}
```

Then call `predict`:

```json
{
  "model_id": "sentiment",
  "text": "I love this purchase",
  "top_k": 2
}
```

Use representative training and held-out evaluation data. Training success is
not evidence that the classifier generalizes.

## Optional SurrealDB persistence

The sample credentials below are for disposable local development only. Do not
use them on a reachable database.

```bash
surreal start --log info --user root --pass root memory
npm run build
npm run init-db
```

Enable persistence in the MCP server environment:

```json
{
  "ENABLE_PERSISTENCE": "true",
  "LOG_PREDICTIONS": "false",
  "SURREALDB_URL": "ws://127.0.0.1:8000/rpc",
  "SURREALDB_NAMESPACE": "astermind",
  "SURREALDB_DATABASE": "development",
  "SURREALDB_USERNAME": "root",
  "SURREALDB_PASSWORD": "root"
}
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `ENABLE_PERSISTENCE` | `false` | Enable database-backed tools |
| `LOG_PREDICTIONS` | `false` | Log predictions unless a call explicitly opts out |
| `SURREALDB_URL` | `ws://127.0.0.1:8000/rpc` | SurrealDB RPC endpoint |
| `SURREALDB_NAMESPACE` | `astermind` | Namespace |
| `SURREALDB_DATABASE` | `production` | Database name |
| `SURREALDB_USERNAME` | `root` | Database user |
| `SURREALDB_PASSWORD` | `root` | Database password |

Persisted models are loaded explicitly with `load_model_persistent`; they are
not automatically loaded after restart. If global prediction logging is on,
`"log_prediction": false` disables it for an individual request. Prediction
logging is best-effort and non-blocking: inference still returns when the
database is slow or unavailable, and logging failures are reported on stderr.

Prediction records contain the input text. Enabling logging therefore changes
the privacy boundary: protect the database, credentials, backups, and access
logs appropriately. “Local” only means local when both the MCP client and the
configured database endpoint are local.

## Monitoring semantics

- Accuracy and confusion matrices require predictions logged with
  `ground_truth`.
- Drift compares predicted-label distributions with Jensen-Shannon
  divergence; it does not measure accuracy degradation or causal drift.
- `detect_drift` returns `status: "insufficient_data"` and null drift fields if
  either comparison window has no samples.
- Monitoring queries currently materialize matching prediction rows in the
  server, so benchmark and redesign aggregation before high-volume use.

## Test layers

- Unit tests cover validation, model lifecycle, encoding, persistence queries,
  metrics, drift, and vector search.
- Handler tests cover all 16 tool-dispatch paths and model serialization.
- A real stdio MCP test starts the compiled child server and exercises protocol
  discovery, training, prediction, and error responses.
- SurrealDB integration tests are opt-in and require an initialized disposable
  database:

```bash
npm run build
SURREALDB_URL=ws://127.0.0.1:8000/rpc \
SURREALDB_NAMESPACE=astermind_test \
SURREALDB_DATABASE=integration \
npm run init-db

SURREALDB_TEST_URL=ws://127.0.0.1:8000/rpc \
SURREALDB_TEST_NAMESPACE=astermind_test \
SURREALDB_TEST_DATABASE=integration \
npm run test:integration
```

## Current limitations

- There is no built-in train/validation split, evaluation dataset tool, model
  selection, calibration analysis, or batch prediction API.
- Confidence scores should not be treated as calibrated probabilities without
  measurement.
- Model records store serialized weights but are not encrypted by this server.
- Database schema evolution is handled by the initialization script, not a
  versioned migration system.
- Vector search uses a database cosine-similarity query without a declared
  vector index; it is not an approximate-nearest-neighbor service.

These constraints make the project best suited to local prototypes, personal
automation, and bounded internal workloads until workload-specific evaluation,
security review, and operational testing are complete.

## Project structure

```text
src/index.ts                         MCP schemas, server, and tool handlers
src/model-manager.ts                 In-memory model lifecycle
src/tool-validation.ts               Runtime input validation
src/text-features.ts                 Shared normalized text encoding
src/persistence/surrealdb-client.ts  Persistence and monitoring operations
src/scripts/init-db.ts               SurrealDB schema initialization
tests/                               Unit, handler, stdio, and DB integration tests
```

See [PERSISTENCE_GUIDE.md](PERSISTENCE_GUIDE.md) for persistence examples. The
proposal and completion-summary documents in the repository are historical and
are not evidence of the current release quality.

## License

MIT
