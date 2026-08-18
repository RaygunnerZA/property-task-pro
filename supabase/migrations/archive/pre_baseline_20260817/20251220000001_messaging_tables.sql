-- Create conversations table for messaging system
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'task', 'property', 'compliance', 'contractor'
  subject TEXT,
  external_ref TEXT,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'web', 'email', 'sms', etc.
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  author_name TEXT,
  author_role TEXT,
  author_user_id UUID, -- References auth.users(id)
  body TEXT NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
DROP POLICY IF EXISTS "Users can view conversations in their org" ON conversations;
CREATE POLICY "Users can view conversations in their org"
ON conversations FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create conversations in their org" ON conversations;
CREATE POLICY "Users can create conversations in their org"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for messages
DROP POLICY IF EXISTS "Users can view messages in their org conversations" ON messages;
CREATE POLICY "Users can view messages in their org conversations"
ON messages FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create messages in their org conversations" ON messages;
CREATE POLICY "Users can create messages in their org conversations"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

