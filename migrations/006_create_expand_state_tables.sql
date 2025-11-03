-- Create tables for storing category and subcategory expand/collapse state

-- Category expand state table
CREATE TABLE IF NOT EXISTS category_expand_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL UNIQUE,
    is_expanded BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subcategory expand state table
CREATE TABLE IF NOT EXISTS subcategory_expand_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100) NOT NULL,
    is_expanded BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (category, sub_category)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_category_expand_state_category ON category_expand_state(category);
CREATE INDEX IF NOT EXISTS idx_subcategory_expand_state_category ON subcategory_expand_state(category);
CREATE INDEX IF NOT EXISTS idx_subcategory_expand_state_sub_category ON subcategory_expand_state(sub_category);

-- Add comments
COMMENT ON TABLE category_expand_state IS 'カテゴリー展開状態管理テーブル';
COMMENT ON COLUMN category_expand_state.category IS 'カテゴリー名';
COMMENT ON COLUMN category_expand_state.is_expanded IS '展開状態 (true: 展開, false: 折りたたみ)';

COMMENT ON TABLE subcategory_expand_state IS 'サブカテゴリー展開状態管理テーブル';
COMMENT ON COLUMN subcategory_expand_state.category IS 'カテゴリー名';
COMMENT ON COLUMN subcategory_expand_state.sub_category IS 'サブカテゴリー名';
COMMENT ON COLUMN subcategory_expand_state.is_expanded IS '展開状態 (true: 展開, false: 折りたたみ)';
