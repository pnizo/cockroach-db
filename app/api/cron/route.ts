import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import nodemailer from 'nodemailer';

interface Member {
  id: string;
  name: string;
  email: string;
}

interface Task {
  id: string;
  name: string;
  category: string;
  sub_category: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Event {
  id: string;
  name: string;
  due_date: string;
  status: string;
  task_name: string;
  task_category: string;
  task_sub_category: string;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  try {
    console.log('[CRON] Starting cron job...');
    console.log('[CRON] GMAIL_USER:', process.env.GMAIL_USER ? 'Set' : 'Not set');
    console.log('[CRON] GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Set (length: ' + process.env.GMAIL_APP_PASSWORD.length + ')' : 'Not set');

    // Get all active members with email addresses
    const members = await query<Member>(
      'SELECT id, name, email FROM member WHERE is_active = true AND email IS NOT NULL AND email != $1',
      ['']
    );

    console.log('[CRON] Found members:', members.length);
    members.forEach(m => console.log(`[CRON] - ${m.name} (${m.email})`));

    if (!members || members.length === 0) {
      console.log('[CRON] No active members with email found');
      return NextResponse.json({ message: 'No active members with email found' });
    }

    // Configure nodemailer transporter
    console.log('[CRON] Configuring nodemailer transporter...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log('[CRON] Transporter verified successfully');
    } catch (verifyError) {
      console.error('[CRON] Transporter verification failed:', verifyError);
      throw verifyError;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('[CRON] Date range - Today:', today.toISOString(), 'Tomorrow:', tomorrow.toISOString());

    let emailsSent = 0;

    // Send email to each member
    for (const member of members) {
      console.log(`[CRON] Processing member: ${member.name} (${member.email})`);

      // Get tasks assigned to this member that are overdue and not done
      const tasks = await query<Task>(
        `SELECT id, name, category, sub_category, start_date, end_date, status
         FROM task
         WHERE assignee = $1
         AND start_date < CURRENT_TIMESTAMP
         AND status != $2
         ORDER BY start_date ASC`,
        [member.name, 'Done']
      );

      console.log(`[CRON] - Found ${tasks.length} incomplete tasks for ${member.name}`);

      // Get events assigned to this member for today
      const events = await query<Event>(
        `SELECT e.id, e.name, e.due_date, e.status, t.name as task_name, t.category as task_category, t.sub_category as task_sub_category
         FROM event e
         JOIN task t ON e.task_id = t.id
         WHERE e.assignee = $1
         AND e.due_date >= $2
         AND e.due_date < $3
         ORDER BY e.due_date ASC`,
        [member.name, today.toISOString(), tomorrow.toISOString()]
      );

      console.log(`[CRON] - Found ${events.length} events for today for ${member.name}`);

      // Skip if no tasks or events to report
      if ((!tasks || tasks.length === 0) &&
          (!events || events.length === 0)) {
        console.log(`[CRON] - Skipping ${member.name} (no tasks or events to report)`);
        continue;
      }

      // Build email content
      let emailContent = `<h2>こんにちは、${member.name}さん</h2>\n\n`;

      // Add today's events section
      if (events && events.length > 0) {
        emailContent += `<h3>📅 本日のイベント (${events.length}件)</h3>\n`;
        emailContent += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">\n';
        emailContent += '<thead><tr style="background-color: #f0f0f0;"><th>イベント名</th><th>タスク名</th><th>サブカテゴリー</th><th>カテゴリー</th><th>期日</th><th>ステータス</th></tr></thead>\n';
        emailContent += '<tbody>\n';

        for (const event of events) {
          const dueDate = event.due_date ? new Date(event.due_date).toLocaleDateString('ja-JP') : '-';
          emailContent += `<tr>
            <td>${event.name}</td>
            <td>${event.task_name}</td>
            <td>${event.task_sub_category}</td>
            <td>${event.task_category}</td>
            <td>${dueDate}</td>
            <td>${event.status}</td>
          </tr>\n`;
        }

        emailContent += '</tbody></table>\n';
      }

      // Add overdue tasks section
      if (tasks && tasks.length > 0) {
        emailContent += `<h3>📋 未完了タスク (${tasks.length}件)</h3>\n`;
        emailContent += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">\n';
        emailContent += '<thead><tr style="background-color: #f0f0f0;"><th>タスク名</th><th>サブカテゴリー</th><th>カテゴリー</th><th>開始日</th><th>終了日</th><th>ステータス</th></tr></thead>\n';
        emailContent += '<tbody>\n';

        for (const task of tasks) {
          const startDate = task.start_date ? new Date(task.start_date).toLocaleDateString('ja-JP') : '-';
          const endDate = task.end_date ? new Date(task.end_date).toLocaleDateString('ja-JP') : '-';
          emailContent += `<tr>
            <td>${task.name}</td>
            <td>${task.sub_category}</td>
            <td>${task.category}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td>${task.status}</td>
          </tr>\n`;
        }

        emailContent += '</tbody></table>\n<br>\n';
      }



      emailContent += '\n<br><p style="color: #666;">このメールは<a href="https://n-prod-task.vercel.app/" target="_blank">タスク管理システム</a>より自動送信されています。</p>';

      console.log(`[CRON] - Preparing to send email to ${member.email}`);
      console.log(`[CRON] - Email content length: ${emailContent.length} characters`);

      // Send email
      try {
        const info = await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: member.email,
          subject: `【タスク管理】デイリーレポート - ${new Date().toLocaleDateString('ja-JP')}`,
          html: emailContent,
        });

        console.log(`[CRON] ✓ Email sent to ${member.name} (${member.email})`);
        console.log(`[CRON] - Message ID: ${info.messageId}`);
        console.log(`[CRON] - Response: ${info.response}`);
        emailsSent++;
      } catch (emailError) {
        console.error(`[CRON] ✗ Failed to send email to ${member.email}:`, emailError);
        console.error(`[CRON] - Error details:`, JSON.stringify(emailError, null, 2));
      }
    }

    console.log(`[CRON] Cron job completed. Emails sent: ${emailsSent}/${members.length}`);

    return NextResponse.json({
      message: 'Emails sent successfully',
      recipientCount: members.length,
      emailsSent: emailsSent
    });

  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json(
      { error: 'Failed to send emails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
