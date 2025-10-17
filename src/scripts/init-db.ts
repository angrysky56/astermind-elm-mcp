#!/usr/bin/env node
/**
 * Database Initialization Script
 * Sets up SurrealDB schema for AsterMind-ELM persistence
 */

import { Surreal } from 'surrealdb';

const DB_CONFIG = {
  url: process.env.SURREALDB_URL || 'ws://127.0.0.1:8000/rpc',
  namespace: process.env.SURREALDB_NAMESPACE || 'astermind',
  database: process.env.SURREALDB_DATABASE || 'production',
  username: process.env.SURREALDB_USERNAME || 'root',
  password: process.env.SURREALDB_PASSWORD || 'root',
};

async function initDatabase() {
  console.log('🚀 Initializing AsterMind-ELM database...');
  console.log(`📍 URL: ${DB_CONFIG.url}`);
  console.log(`📦 Namespace: ${DB_CONFIG.namespace}`);
  console.log(`💾 Database: ${DB_CONFIG.database}\n`);

  const db = new Surreal();

  try {
    await db.connect(DB_CONFIG.url);
    console.log('✅ Connected to SurrealDB');

    await db.signin({
      username: DB_CONFIG.username,
      password: DB_CONFIG.password,
    });
    console.log('✅ Signed in successfully');

    await db.use({
      namespace: DB_CONFIG.namespace,
      database: DB_CONFIG.database,
    });
    console.log(`✅ Using ${DB_CONFIG.namespace}:${DB_CONFIG.database}\n`);

    console.log('📋 Creating tables...');

    // Models table
    await db.query(`
      DEFINE TABLE IF NOT EXISTS models SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS model_id ON models TYPE string ASSERT $value != NONE;
      DEFINE FIELD IF NOT EXISTS version ON models TYPE string ASSERT $value != NONE;
      DEFINE FIELD IF NOT EXISTS config ON models TYPE object;
      DEFINE FIELD IF NOT EXISTS weights ON models TYPE string;
      DEFINE FIELD IF NOT EXISTS categories ON models TYPE array<string>;
      DEFINE FIELD IF NOT EXISTS created_at ON models TYPE datetime DEFAULT time::now();
      DEFINE FIELD IF NOT EXISTS trained_on ON models TYPE option<string>;
      DEFINE FIELD IF NOT EXISTS tags ON models TYPE array<string> DEFAULT [];
      DEFINE FIELD IF NOT EXISTS metadata ON models TYPE object DEFAULT {};
      DEFINE FIELD IF NOT EXISTS status ON models TYPE string DEFAULT 'active';
      DEFINE FIELD IF NOT EXISTS description ON models TYPE option<string>;
      DEFINE INDEX IF NOT EXISTS model_version_idx ON models FIELDS model_id, version UNIQUE;
      DEFINE INDEX IF NOT EXISTS model_status_idx ON models FIELDS model_id, status;
    `);
    console.log('  ✅ models table');

    // Datasets table
    await db.query(`
      DEFINE TABLE IF NOT EXISTS datasets SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS dataset_id ON datasets TYPE string ASSERT $value != NONE;
      DEFINE FIELD IF NOT EXISTS examples ON datasets TYPE array<object>;
      DEFINE FIELD IF NOT EXISTS examples.*.text ON datasets TYPE string;
      DEFINE FIELD IF NOT EXISTS examples.*.label ON datasets TYPE string;
      DEFINE FIELD IF NOT EXISTS size ON datasets TYPE number;
      DEFINE FIELD IF NOT EXISTS created_at ON datasets TYPE datetime DEFAULT time::now();
      DEFINE FIELD IF NOT EXISTS metadata ON datasets TYPE object DEFAULT {};
      DEFINE INDEX IF NOT EXISTS dataset_id_idx ON datasets FIELDS dataset_id UNIQUE;
    `);
    console.log('  ✅ datasets table (with nested field schema)');

    // Predictions table
    await db.query(`
      DEFINE TABLE IF NOT EXISTS predictions SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS model_id ON predictions TYPE string;
      DEFINE FIELD IF NOT EXISTS version ON predictions TYPE string;
      DEFINE FIELD IF NOT EXISTS input_text ON predictions TYPE string;
      DEFINE FIELD IF NOT EXISTS predicted_label ON predictions TYPE string;
      DEFINE FIELD IF NOT EXISTS confidence ON predictions TYPE float;
      DEFINE FIELD IF NOT EXISTS ground_truth ON predictions TYPE option<string>;
      DEFINE FIELD IF NOT EXISTS correct ON predictions TYPE option<bool>;
      DEFINE FIELD IF NOT EXISTS latency_ms ON predictions TYPE float;
      DEFINE FIELD IF NOT EXISTS timestamp ON predictions TYPE datetime DEFAULT time::now();
      DEFINE FIELD IF NOT EXISTS metadata ON predictions TYPE object DEFAULT {};
      DEFINE INDEX IF NOT EXISTS predictions_time_idx ON predictions FIELDS timestamp;
      DEFINE INDEX IF NOT EXISTS predictions_model_idx ON predictions FIELDS model_id, timestamp;
    `);
    console.log('  ✅ predictions table');

    // Metrics table
    await db.query(`
      DEFINE TABLE IF NOT EXISTS metrics SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS model_id ON metrics TYPE string;
      DEFINE FIELD IF NOT EXISTS version ON metrics TYPE string;
      DEFINE FIELD IF NOT EXISTS metric_name ON metrics TYPE string;
      DEFINE FIELD IF NOT EXISTS metric_value ON metrics TYPE float;
      DEFINE FIELD IF NOT EXISTS window_start ON metrics TYPE datetime;
      DEFINE FIELD IF NOT EXISTS window_end ON metrics TYPE datetime;
      DEFINE FIELD IF NOT EXISTS sample_count ON metrics TYPE number;
      DEFINE INDEX IF NOT EXISTS metrics_model_time_idx ON metrics FIELDS model_id, metric_name, window_start;
    `);
    console.log('  ✅ metrics table');

    // Embeddings table
    await db.query(`
      DEFINE TABLE IF NOT EXISTS embeddings SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS collection_name ON embeddings TYPE string;
      DEFINE FIELD IF NOT EXISTS item_id ON embeddings TYPE string;
      DEFINE FIELD IF NOT EXISTS text ON embeddings TYPE string;
      DEFINE FIELD IF NOT EXISTS embedding ON embeddings TYPE array<float>;
      DEFINE FIELD IF NOT EXISTS metadata ON embeddings TYPE object DEFAULT {};
      DEFINE FIELD IF NOT EXISTS created_at ON embeddings TYPE datetime DEFAULT time::now();
      DEFINE INDEX IF NOT EXISTS embeddings_collection_idx ON embeddings FIELDS collection_name, item_id UNIQUE;
    `);
    console.log('  ✅ embeddings table\n');

    console.log('✨ Database initialization complete!');
    console.log('\n📊 Tables created:');
    console.log('  • models - ML model storage with versioning');
    console.log('  • datasets - Training data management');
    console.log('  • predictions - Prediction logging for monitoring');
    console.log('  • metrics - Aggregated performance metrics');
    console.log('  • embeddings - Vector store for similarity search');
    
    console.log('\n🎯 Ready to use! You can now:');
    console.log('  1. Train models with persistence');
    console.log('  2. Log predictions for monitoring');
    console.log('  3. Track performance over time');
    console.log('  4. Search similar embeddings\n');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

initDatabase().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
