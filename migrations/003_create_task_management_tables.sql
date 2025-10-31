-- Create Task table
CREATE TABLE IF NOT EXISTS task (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100) NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    assignee VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ToDo' CHECK (status IN ('ToDo', 'InProgress', 'Confirmed', 'IceBox', 'Done')),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Event table
CREATE TABLE IF NOT EXISTS event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    task_id UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
    due_date TIMESTAMP,
    assignee VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ToDo' CHECK (status IN ('ToDo', 'InProgress', 'Confirmed', 'IceBox', 'Done')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_category ON task(category);
CREATE INDEX IF NOT EXISTS idx_task_sub_category ON task(sub_category);
CREATE INDEX IF NOT EXISTS idx_task_status ON task(status);
CREATE INDEX IF NOT EXISTS idx_task_display_order ON task(display_order);
CREATE INDEX IF NOT EXISTS idx_event_task_id ON event(task_id);
CREATE INDEX IF NOT EXISTS idx_event_due_date ON event(due_date);
CREATE INDEX IF NOT EXISTS idx_event_status ON event(status);

-- Create table to manage category display order
CREATE TABLE IF NOT EXISTS category_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table to manage subcategory display order
CREATE TABLE IF NOT EXISTS subcategory_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (category, sub_category)
);

CREATE INDEX IF NOT EXISTS idx_subcategory_order_category ON subcategory_order(category);

-- Add comments to tables and columns
COMMENT ON TABLE task IS 'タスク管理テーブル';
COMMENT ON COLUMN task.id IS 'タスクID (UUID)';
COMMENT ON COLUMN task.name IS 'タスク名';
COMMENT ON COLUMN task.category IS 'カテゴリー';
COMMENT ON COLUMN task.sub_category IS 'サブカテゴリー';
COMMENT ON COLUMN task.start_date IS '開始日';
COMMENT ON COLUMN task.end_date IS '終了日';
COMMENT ON COLUMN task.assignee IS '担当者';
COMMENT ON COLUMN task.status IS 'ステータス';
COMMENT ON COLUMN task.display_order IS '表示順序';

COMMENT ON TABLE event IS 'イベント管理テーブル';
COMMENT ON COLUMN event.id IS 'イベントID (UUID)';
COMMENT ON COLUMN event.name IS 'イベント名';
COMMENT ON COLUMN event.task_id IS '親タスクID';
COMMENT ON COLUMN event.due_date IS '期日';
COMMENT ON COLUMN event.assignee IS '担当者';
COMMENT ON COLUMN event.status IS 'ステータス';

COMMENT ON TABLE category_order IS 'カテゴリー表示順序テーブル';
COMMENT ON TABLE subcategory_order IS 'サブカテゴリー表示順序テーブル';
