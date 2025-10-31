import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const tasks = await query(`
      SELECT
        t.id,
        t.name,
        t.category,
        t.sub_category,
        t.start_date::DATE::TEXT as start_date,
        t.end_date::DATE::TEXT as end_date,
        t.assignee,
        t.status,
        t.display_order,
        t.created_at,
        t.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id,
              'name', e.name,
              'due_date', e.due_date::DATE::TEXT,
              'assignee', e.assignee,
              'status', e.status,
              'task_id', e.task_id
            )
            ORDER BY e.due_date
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'
        ) as events
      FROM task t
      LEFT JOIN event e ON t.id = e.task_id
      GROUP BY t.id
      ORDER BY t.category, t.sub_category, t.display_order, t.created_at
    `);

    // console.log('=== GET /api/tasks DEBUG ===');
    // if (tasks.length > 0) {
    //   console.log('Sample task dates from DB:');
    //   console.log('First task start_date:', tasks[0]?.start_date);
    //   console.log('First task end_date:', tasks[0]?.end_date);
    //   console.log('First task start_date type:', typeof tasks[0]?.start_date);
    // }
    // console.log('=== END GET /api/tasks DEBUG ===');

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, sub_category, start_date, end_date, assignee, status, display_order } = body;

    // console.log('=== POST /api/tasks DEBUG ===');
    // console.log('Received start_date:', start_date);
    // console.log('Received end_date:', end_date);

    if (!name || !category || !sub_category) {
      return NextResponse.json(
        { error: 'Name, category, and sub_category are required' },
        { status: 400 }
      );
    }

    // Convert empty strings to null for nullable fields, and extract date part only
    const sanitizedStartDate = start_date === '' ? null : (start_date ? start_date.split('T')[0] : null);
    const sanitizedEndDate = end_date === '' ? null : (end_date ? end_date.split('T')[0] : null);
    const sanitizedAssignee = assignee === '' ? null : assignee || null;

    // console.log('Sanitized start_date:', sanitizedStartDate);
    // console.log('Sanitized end_date:', sanitizedEndDate);

    const result = await query(
      `INSERT INTO task (name, category, sub_category, start_date, end_date, assignee, status, display_order)
       VALUES ($1, $2, $3, $4::DATE, $5::DATE, $6, $7, COALESCE($8, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM task)))
       RETURNING id, name, category, sub_category, start_date::DATE::TEXT as start_date, end_date::DATE::TEXT as end_date, assignee, status, display_order, created_at, updated_at`,
      [name, category, sub_category, sanitizedStartDate, sanitizedEndDate, sanitizedAssignee, status || 'ToDo', display_order]
    );

    // console.log('DB returned start_date:', result[0]?.start_date);
    // console.log('DB returned end_date:', result[0]?.end_date);
    // console.log('=== END POST /api/tasks DEBUG ===');

    return NextResponse.json({ task: result[0] });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, category, sub_category, start_date, end_date, assignee, status, display_order } = body;

    // console.log('=== PUT /api/tasks DEBUG ===');
    // console.log('Task ID:', id);
    // console.log('Received start_date:', start_date);
    // console.log('Received end_date:', end_date);

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Convert empty strings to null for nullable fields, and extract date part only
    const sanitizedStartDate = start_date === '' ? null : (start_date ? start_date.split('T')[0] : null);
    const sanitizedEndDate = end_date === '' ? null : (end_date ? end_date.split('T')[0] : null);
    const sanitizedAssignee = assignee === '' ? null : assignee;

    // console.log('Sanitized start_date:', sanitizedStartDate);
    // console.log('Sanitized end_date:', sanitizedEndDate);

    const result = await query(
      `UPDATE task
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           sub_category = COALESCE($3, sub_category),
           start_date = $4::DATE,
           end_date = $5::DATE,
           assignee = $6,
           status = COALESCE($7, status),
           display_order = COALESCE($8, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, name, category, sub_category, start_date::DATE::TEXT as start_date, end_date::DATE::TEXT as end_date, assignee, status, display_order, created_at, updated_at`,
      [name, category, sub_category, sanitizedStartDate, sanitizedEndDate, sanitizedAssignee, status, display_order, id]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // console.log('DB returned start_date:', result[0]?.start_date);
    // console.log('DB returned end_date:', result[0]?.end_date);
    // console.log('=== END PUT /api/tasks DEBUG ===');

    return NextResponse.json({ task: result[0] });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    await query('DELETE FROM task WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
