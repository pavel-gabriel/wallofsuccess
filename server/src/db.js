import pg from 'pg';

// One shared pool. DATABASE_URL is provided by the deployment (Helm secret).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
}

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX || 10),
});

export function query(text, params) {
  return pool.query(text, params);
}

// Convenience: return the first row or null.
export async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}
