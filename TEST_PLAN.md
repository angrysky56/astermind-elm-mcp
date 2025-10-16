# AsterMind-ELM SurrealDB Testing Plan

## Prerequisites
✅ Timestamp fix applied
✅ TypeScript compiled successfully  
⏳ **Restart Claude Desktop to load fixed server**

## Test Environment Setup

### 1. Ensure SurrealDB is Running
```bash
# Check if SurrealDB is running
ps aux | grep surreal

# If not running, start it:
surreal start --log trace --user root --pass root memory
```

### 2. Enable Persistence
Set environment variable before starting Claude:
```bash
export ENABLE_PERSISTENCE=true
```

## Test Suite

### Phase 1: Basic Model Operations (In-Memory)

**Test 1.1: Train Classifier**
```json
{
  "model_id": "test_model_v1",
  "description": "Basic sentiment classifier",
  "training_data": [
    {"text": "Love it", "label": "positive"},
    {"text": "Hate it", "label": "negative"},
    {"text": "Amazing product", "label": "positive"},
    {"text": "Terrible quality", "label": "negative"}
  ]
}
```
Expected: ✅ Success with model metadata

**Test 1.2: Make Prediction (No Logging)**
```json
{
  "model_id": "test_model_v1",
  "text": "This is wonderful",
  "log_prediction": false
}
```
Expected: ✅ Prediction results with confidence scores

### Phase 2: Persistence Operations

**Test 2.1: Store Training Dataset**
```json
{
  "dataset_id": "sentiment_dataset_v1",
  "training_data": [
    {"text": "Great", "label": "positive"},
    {"text": "Poor", "label": "negative"}
  ],
  "metadata": {
    "source": "test",
    "date": "2025-10-16"
  }
}
```
Expected: ✅ Dataset stored with record ID

**Test 2.2: Load Training Dataset**
```json
{
  "dataset_id": "sentiment_dataset_v1"
}
```
Expected: ✅ Dataset retrieved with examples

**Test 2.3: Store Model Persistent**
```json
{
  "model_id": "test_model_v1",
  "version": "1.0.0",
  "description": "Production sentiment model",
  "tags": ["production", "sentiment"]
}
```
Expected: ✅ Model persisted to SurrealDB

**Test 2.4: List Model Versions**
```json
{
  "model_id": "test_model_v1"
}
```
Expected: ✅ List of versions with metadata

**Test 2.5: Load Model Persistent**
```json
{
  "model_id": "test_model_v1",
  "version": "1.0.0"
}
```
Expected: ✅ Model loaded into memory

### Phase 3: Prediction Logging

**Test 3.1: Log Prediction**
```json
{
  "model_id": "test_model_v1",
  "text": "Excellent service",
  "log_prediction": true,
  "ground_truth": "positive"
}
```
Expected: ✅ Prediction logged to database

**Test 3.2: Log Multiple Predictions**
Run 5-10 predictions with ground truth
Expected: ✅ All predictions logged

### Phase 4: Monitoring Operations

**Test 4.1: Get Model Metrics**
```json
{
  "model_id": "test_model_v1"
}
```
Expected: ✅ Metrics including accuracy, avg confidence, latency

**Test 4.2: Get Confusion Matrix**
```json
{
  "model_id": "test_model_v1"
}
```
Expected: ✅ Matrix showing prediction accuracy by class

**Test 4.3: Detect Drift**
```json
{
  "model_id": "test_model_v1",
  "baseline_window": {
    "start": "2025-10-16T20:00:00Z",
    "end": "2025-10-16T20:30:00Z"
  },
  "current_window": {
    "start": "2025-10-16T20:30:00Z",
    "end": "2025-10-16T21:00:00Z"
  }
}
```
Expected: ✅ Drift analysis with score and distributions

### Phase 5: Embedding Operations

**Test 5.1: Generate Embedding**
```json
{
  "model_id": "test_model_v1",
  "text": "This is a test"
}
```
Expected: ✅ Embedding vector

**Test 5.2: Store Embeddings**
```json
{
  "collection_name": "test_collection",
  "items": [
    {
      "item_id": "item1",
      "text": "First text",
      "embedding": [0.1, 0.2, 0.3],
      "metadata": {"category": "test"}
    },
    {
      "item_id": "item2",
      "text": "Second text",
      "embedding": [0.2, 0.3, 0.4],
      "metadata": {"category": "test"}
    }
  ]
}
```
Expected: ✅ Embeddings stored

**Test 5.3: Search Similar**
```json
{
  "collection_name": "test_collection",
  "query_embedding": [0.15, 0.25, 0.35],
  "top_k": 2
}
```
Expected: ✅ Similar items with similarity scores

## Success Criteria

✅ All tests pass without timestamp errors
✅ Data persists across server restarts
✅ Metrics and monitoring work correctly
✅ Embeddings store and search properly

## Troubleshooting

### If timestamp errors still occur:
1. Verify Claude Desktop was restarted
2. Check MCP server logs: `~/.config/Claude/logs/`
3. Verify SurrealDB is running
4. Check ENABLE_PERSISTENCE is set

### If SurrealDB connection fails:
```bash
# Start SurrealDB in memory mode
surreal start --log trace --user root --pass root memory

# Or with file persistence
surreal start --log trace --user root --pass root file://astermind.db
```

## Expected Outcomes

After all tests pass:
- ✅ No timestamp conversion errors
- ✅ Models persist and load correctly
- ✅ Prediction logging works
- ✅ Monitoring and metrics functional
- ✅ Embedding similarity search operational

## Performance Notes

- Training: Milliseconds for 100s of examples
- Prediction: Microseconds per prediction  
- Database ops: Should complete in <100ms
- Embedding search: <50ms for 1000s of vectors
