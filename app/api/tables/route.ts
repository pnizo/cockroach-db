import { NextResponse } from 'next/server';
import { getTableNames } from '@/lib/db';

export async function GET() {
  try {
    const tables = await getTableNames();
    return NextResponse.json({ tables });
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
  }
}
