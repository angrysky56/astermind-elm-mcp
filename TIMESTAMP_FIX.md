# SurrealDB Timestamp Fix

## Problem
All SurrealDB persistence operations were failing with timestamp errors:
```
Found '2025-10-16T20:08:35.467Z' for field 'timestamp' but expected a datetime
```

## Root Cause
The code was converting JavaScript Date objects to ISO strings using `.toISOString()`, but SurrealDB expects native Date objects or will convert them properly at the database level.

## Solution Applied

### 1. Updated `src/persistence/surrealdb-client.ts`
Changed all timestamp assignments from:
```typescript
created_at: new Date().toISOString()  // ❌ Wrong - produces string
```

To:
```typescript
created_at: new Date()  // ✅ Correct - SurrealDB handles Date objects
```

**Fixed locations:**
- Line 72: `storeModel()` - created_at field
- Line 151: `storeDataset()` - created_at field  
- Line 193: `logPrediction()` - timestamp field
- Line 343: `storeEmbeddings()` - created_at field
- Line 209-210: `getModelMetrics()` - query parameters
- Line 238-239: `getConfusionMatrix()` - query parameters
- Multiple lines in `detectDrift()` - query parameters

### 2. Updated `src/persistence/types.ts`
Changed all date field types to accept both Date and string:
```typescript
created_at: string | Date  // Accepts Date for inserts, string for reads
timestamp: string | Date
window_start: string | Date
window_end: string | Date
```

**Updated interfaces:**
- `StoredModel` - created_at
- `StoredDataset` - created_at
- `PredictionLog` - timestamp
- `EmbeddingRecord` - created_at
- `MetricRecord` - window_start, window_end

## Testing Status

✅ **Build Status:** TypeScript compilation successful
⏳ **Runtime Testing:** Pending server restart

## Next Steps

1. **Restart Claude Desktop** to load the fixed MCP server
2. Test all persistence operations:
   - [ ] Model persistence (`store_model_persistent`)
   - [ ] Dataset storage (`store_training_dataset`)
   - [ ] Prediction logging (`predict` with `log_prediction: true`)
   - [ ] Embedding storage (`store_embeddings`)
   - [ ] Metrics retrieval (`get_model_metrics`)
   - [ ] Drift detection (`detect_drift`)

## Files Modified
- `/src/persistence/surrealdb-client.ts` - 9 fixes
- `/src/persistence/types.ts` - 5 interface updates

## Technical Notes

**Why Date objects work:**
- SurrealDB JavaScript SDK automatically converts Date objects to SurrealDB's datetime type
- When reading from database, dates come back as ISO strings
- Using `Date | string` union type accommodates both insert and read operations

**Why strings don't work:**
- Plain ISO strings are treated as text, not datetime types
- SurrealDB's schema validation rejects strings for datetime fields
- The error message explicitly requests datetime type conversion
