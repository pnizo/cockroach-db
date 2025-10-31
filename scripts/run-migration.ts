import { config } from 'dotenv';
import { getPool } from '../lib/db';
import fs from 'fs';
import path from 'path';

// Load environment variables
config({ path: '.env.local' });

async function runMigration() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  const pool = getPool();

  try {
    const migrationFile = path.join(process.cwd(), 'migrations', '004_create_member_table.sql');
    const sql = fs.readFileSync(migrationFile, 'utf-8');

    console.log('Running migration: 004_create_member_table.sql');
    await pool.query(sql);
    console.log('Migration completed successfully!');

    // // Insert sample member data
    // console.log('Inserting sample member data...');
    // await pool.query(`
    //   INSERT INTO member (name, email, role, is_active)
    //   VALUES
    //     ('山田太郎', 'yamada@example.com', 'バックエンドエンジニア', true),
    //     ('佐藤花子', 'sato@example.com', 'フロントエンドエンジニア', true),
    //     ('鈴木一郎', 'suzuki@example.com', 'プロジェクトマネージャー', true),
    //     ('田中美咲', 'tanaka@example.com', 'デザイナー', true),
    //     ('高橋健太', 'takahashi@example.com', 'QAエンジニア', true)
    // `);

    // console.log('Sample data inserted successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
