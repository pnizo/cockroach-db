import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');

    let events;
    if (taskId) {
      events = await query(
        'SELECT id, name, task_id, due_date::DATE::TEXT as due_date, assignee, status, note, created_at, updated_at FROM event WHERE task_id = $1 ORDER BY due_date',
        [taskId]
      );
    } else {
      events = await query('SELECT id, name, task_id, due_date::DATE::TEXT as due_date, assignee, status, note, created_at, updated_at FROM event ORDER BY due_date');
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, task_id, due_date, assignee, status, note } = body;

    if (!name || !task_id) {
      return NextResponse.json(
        { error: 'Name and task_id are required' },
        { status: 400 }
      );
    }

    // Validate note length
    if (note && note.length > 1000) {
      return NextResponse.json(
        { error: 'メモは1000文字以内で入力してください' },
        { status: 400 }
      );
    }

    // Convert empty strings to null for nullable fields, and extract date part only
    const sanitizedDueDate = due_date === '' ? null : (due_date ? due_date.split('T')[0] : null);
    const sanitizedAssignee = assignee === '' ? null : assignee || null;
    const sanitizedNote = note === '' ? null : note || null;

    const result = await query(
      `INSERT INTO event (name, task_id, due_date, assignee, status, note)
       VALUES ($1, $2, $3::DATE, $4, $5, $6)
       RETURNING id, name, task_id, due_date::DATE::TEXT as due_date, assignee, status, note, created_at, updated_at`,
      [name, task_id, sanitizedDueDate, sanitizedAssignee, status || 'ToDo', sanitizedNote]
    );

    return NextResponse.json({ event: result[0] });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, task_id, due_date, assignee, status, note } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Validate note length
    if (note && note.length > 1000) {
      return NextResponse.json(
        { error: 'メモは1000文字以内で入力してください' },
        { status: 400 }
      );
    }

    // Convert empty strings to null for nullable fields, and extract date part only
    const sanitizedDueDate = due_date === '' ? null : (due_date ? due_date.split('T')[0] : null);
    const sanitizedAssignee = assignee === '' ? null : assignee;
    const sanitizedNote = note === '' ? null : note;

    const result = await query(
      `UPDATE event
       SET name = COALESCE($1, name),
           task_id = COALESCE($2, task_id),
           due_date = $3::DATE,
           assignee = $4,
           status = COALESCE($5, status),
           note = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, name, task_id, due_date::DATE::TEXT as due_date, assignee, status, note, created_at, updated_at`,
      [name, task_id, sanitizedDueDate, sanitizedAssignee, status, sanitizedNote, id]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ event: result[0] });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    await query('DELETE FROM event WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
