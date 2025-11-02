-- Add note column to task table
ALTER TABLE task ADD COLUMN IF NOT EXISTS note TEXT;

-- Add note column to event table
ALTER TABLE event ADD COLUMN IF NOT EXISTS note TEXT;

-- Add comments
COMMENT ON COLUMN task.note IS 'タスクのメモ（最大1000文字）';
COMMENT ON COLUMN event.note IS 'イベントのメモ（最大1000文字）';
