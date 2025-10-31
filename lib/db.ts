import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

function getPoolConfig(): PoolConfig {
  return {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=verify-full')
      ? { rejectUnauthorized: true }
      : process.env.DATABASE_URL?.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased from 2000ms to 10000ms
    statement_timeout: 30000, // 30 seconds for query execution
    query_timeout: 30000, // 30 seconds for query timeout
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      // Reset pool on error
      pool = null;
    });

    pool.on('connect', () => {
      // console.log('Database connection established');
    });
  }

  return pool;
}

// Function to manually reset the pool if needed
export function resetPool(): void {
  if (pool) {
    pool.end().catch(err => console.error('Error ending pool:', err));
    pool = null;
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await getPool().connect();
      try {
        const result = await client.query(text, params);
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      lastError = error as Error;
      console.error(`Query attempt ${attempt} failed:`, error);

      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 1000; // Progressive backoff: 1s, 2s
        // console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // If all retries failed, throw the last error
  throw lastError || new Error('Query failed after all retries');
}

export async function getTableNames(): Promise<string[]> {
  const result = await query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`
  );
  return result.map(row => row.table_name);
}

export async function getTableSchema(tableName: string): Promise<any[]> {
  return await query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
}

export async function getTableData(tableName: string, limit = 100, offset = 0): Promise<any[]> {
  return await query(
    `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}

export async function getTableCount(tableName: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM "${tableName}"`
  );
  return parseInt(result[0].count, 10);
}
