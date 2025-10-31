-- Create company master table
CREATE TABLE IF NOT EXISTS company (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    pic_name VARCHAR(100),
    pic_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on company name for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_name ON company(name);

-- Create index on pic_email
CREATE INDEX IF NOT EXISTS idx_company_pic_email ON company(pic_email);

-- Add comments to table and columns
COMMENT ON TABLE company IS '会社情報マスタテーブル';
COMMENT ON COLUMN company.id IS '会社ID (UUID)';
COMMENT ON COLUMN company.name IS '会社名';
COMMENT ON COLUMN company.address IS '住所';
COMMENT ON COLUMN company.phone IS '電話番号';
COMMENT ON COLUMN company.pic_name IS '担当者名';
COMMENT ON COLUMN company.pic_email IS '担当者メールアドレス';
COMMENT ON COLUMN company.created_at IS '作成日時';
COMMENT ON COLUMN company.updated_at IS '更新日時';
