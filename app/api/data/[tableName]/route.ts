import { NextResponse } from 'next/server';
import { getTableData, getTableCount, query } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const [data, total] = await Promise.all([
      getTableData(tableName, limit, offset),
      getTableCount(tableName),
    ]);

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await params;
    const body = await request.json();

    const columns = Object.keys(body);
    const values = Object.values(body);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const result = await query(
      `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    return NextResponse.json({ data: result[0] });
  } catch (error) {
    console.error('Error inserting data:', error);
    return NextResponse.json(
      { error: 'Failed to insert data' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await params;
    const body = await request.json();
    const { id, ...updates } = body;

    const columns = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const result = await query(
      `UPDATE "${tableName}" SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id]
    );

    return NextResponse.json({ data: result[0] });
  } catch (error) {
    console.error('Error updating data:', error);
    return NextResponse.json(
      { error: 'Failed to update data' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await params;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    await query(`DELETE FROM "${tableName}" WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting data:', error);
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
