const { Pool } = require('pg');
require('dotenv').config();

/**
 * Database connection pool for marketplace integration
 * This file exports the pool to be used by marketplace routes and jobs
 */

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
  console.log('📊 Database pool connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

module.exports = pool;
