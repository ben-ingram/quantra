-- =============================================================================
-- Chat Sessions Schema for "Ask Code Expert"
-- =============================================================================

-- Chat Sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  jurisdiction TEXT DEFAULT 'Florida',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Structured data for assistant responses
  citations JSONB DEFAULT '[]',          -- Array of {section, title, content, source}
  tables JSONB DEFAULT '[]',             -- Array of table data from code_tables
  compliance_result JSONB,               -- Structured analysis result if applicable

  -- Metadata
  metadata JSONB DEFAULT '{}',           -- Additional data like token counts, timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Updated_at trigger for chat_sessions
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_sessions_updated_at();

-- RLS Policies (optional - enable if using Supabase Auth)
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view own chat sessions"
--   ON chat_sessions FOR SELECT
--   USING (auth.uid() = user_id OR user_id IS NULL);

-- CREATE POLICY "Users can create chat sessions"
--   ON chat_sessions FOR INSERT
--   WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- CREATE POLICY "Users can view messages in own sessions"
--   ON chat_messages FOR SELECT
--   USING (EXISTS (
--     SELECT 1 FROM chat_sessions
--     WHERE id = chat_messages.session_id
--     AND (user_id = auth.uid() OR user_id IS NULL)
--   ));

COMMENT ON TABLE chat_sessions IS 'Stores conversation threads for Ask Code Expert';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat sessions';
COMMENT ON COLUMN chat_messages.citations IS 'Array of code citations referenced in the response';
COMMENT ON COLUMN chat_messages.tables IS 'Structured table data from code_tables for rendering';
