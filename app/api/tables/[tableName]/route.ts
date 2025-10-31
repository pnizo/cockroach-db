import { NextResponse } from 'next/server';
import { getTableSchema } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await params;
    const schema = await getTableSchema(tableName);
    return NextResponse.json({ schema });
  } catch (error) {
    console.error('Error fetching table schema:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table schema' },
      { status: 500 }
    );
  }
}
