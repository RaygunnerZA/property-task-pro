-- Create Notifications Infrastructure (Dormant)
-- Scaffolds notifications engine schema - no triggers, no background jobs, no sending

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References auth.users(id)
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_notifications_org_user ON notifications(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(org_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(org_id, channel);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(org_id, created_at DESC);

-- ============================================================================
-- NOTIFICATION EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- e.g., 'created', 'attempted', 'delivered', 'opened', 'clicked'
  channel notification_channel NOT NULL,
  status notification_status NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_notification_events_notification ON notification_events(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_org ON notification_events(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(org_id, event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_created_at ON notification_events(org_id, created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Notifications: Users can view notifications in their org
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
    AND (
      -- Users can see their own notifications
      user_id = auth.uid()
      OR
      -- Managers/owners can see all notifications in their org
      org_id IN (
        SELECT org_id FROM organisation_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager')
      )
    )
  );

-- Notifications: System can create notifications (no user check for dormant state)
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

-- Notifications: System can update notifications
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

-- Notification Events: Users can view events for notifications they can see
DROP POLICY IF EXISTS "notification_events_select" ON notification_events;
CREATE POLICY "notification_events_select" ON notification_events
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

-- Notification Events: System can create events
DROP POLICY IF EXISTS "notification_events_insert" ON notification_events;
CREATE POLICY "notification_events_insert" ON notification_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );
