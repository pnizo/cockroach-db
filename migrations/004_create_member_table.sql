-- Create Member table
CREATE TABLE IF NOT EXISTS member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on member name for faster lookups
CREATE INDEX IF NOT EXISTS idx_member_name ON member(name);
CREATE INDEX IF NOT EXISTS idx_member_is_active ON member(is_active);

-- Add comments to table and columns
COMMENT ON TABLE member IS 'メンバー管理テーブル';
COMMENT ON COLUMN member.id IS 'メンバーID (UUID)';
COMMENT ON COLUMN member.name IS 'メンバー名';
COMMENT ON COLUMN member.email IS 'メールアドレス';
COMMENT ON COLUMN member.role IS '役割';
COMMENT ON COLUMN member.is_active IS '有効フラグ';
COMMENT ON COLUMN member.created_at IS '作成日時';
COMMENT ON COLUMN member.updated_at IS '更新日時';
