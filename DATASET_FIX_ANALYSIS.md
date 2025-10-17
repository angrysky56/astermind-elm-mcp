# Dataset Storage Fix - Root Cause Analysis

## Problem Identified
**SurrealDB `.create()` method does not preserve nested object properties in arrays.**

### Evidence from Debug Output
```json
{
  "dataset_id": "test_dataset_v1",
  "examples": [{}, {}, {}],  // ← Empty objects!
  "size": 3,
  "metadata": {}
}
```

The data was stored as `[{}, {}, {}]` instead of:
```json
[
  {"text": "Amazing product", "label": "positive"},
  {"text": "Worst ever", "label": "negative"},
  {"text": "Highly recommend", "label": "positive"}
]
```

## Root Cause

The original code used:
```typescript
const result = await this.db.create<StoredDataset>('datasets', {
  dataset_id: params.dataset_id,
  examples: structuredExamples,  // Array of objects lost properties
  size: structuredExamples.length,
  created_at: new Date(),
  metadata: params.metadata || {},
});
```

**Issue:** SurrealDB's `.create()` SDK method has a bug or limitation where nested objects in arrays lose their properties during serialization.

## Solution Applied

Use raw SurrealQL `CREATE ... CONTENT` syntax instead:

```typescript
const query = `
  CREATE datasets CONTENT {
    dataset_id: $dataset_id,
    examples: $examples,
    size: $size,
    created_at: $created_at,
    metadata: $metadata
  }
`;

const result = await this.db.query<any[][]>(query, {
  dataset_id: params.dataset_id,
  examples: structuredExamples,
  size: structuredExamples.length,
  created_at: new Date(),
  metadata: params.metadata || {}
});
```

**Why this works:**
- Raw queries preserve the full structure of parameters
- No SDK serialization layer to strip properties
- Direct SurrealQL execution maintains object integrity

## Testing Plan

1. Store a new dataset (the old one has empty objects already)
2. Load the new dataset
3. Verify all text and label fields are populated

## Expected Result
```json
{
  "dataset_id": "test_dataset_v2",
  "examples": [
    { "text": "Amazing product", "label": "positive" },
    { "text": "Worst ever", "label": "negative" },
    { "text": "Highly recommend", "label": "positive" }
  ],
  "size": 3,
  "metadata": { "source": "customer_reviews", "date": "2025-10-16" }
}
```

## Files Modified
- `src/persistence/surrealdb-client.ts` (storeDataset method, lines ~132-160)

## Status
- ✅ Fix applied
- ✅ Built successfully
- ⏳ Awaiting MCP reload for testing
