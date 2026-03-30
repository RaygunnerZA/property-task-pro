-- AI request observability table.
-- Append-only infrastructure-level log: every AI provider call made by an edge function.
-- Distinct from ai_resolution_audit (UX-level: what AI suggested vs what user chose).
-- Only the service role can INSERT; authenticated users can SELECT their org's records.

CREATE TABLE ai_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name   TEXT        NOT NULL,
  model_used      TEXT        NOT NULL,
  provider        TEXT        NOT NULL,
  prompt_version  TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        NUMERIC(12, 8),
  latency_ms      INTEGER,
  status          TEXT        NOT NULL DEFAULT 'success'
                  CHECK (status IN ('success', 'error', 'timeout', 'fallback')),
  error_message   TEXT,
  entity_type     TEXT,
  entity_id       UUID,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_requests_org_id_idx        ON ai_requests (org_id);
CREATE INDEX ai_requests_created_at_idx    ON ai_requests (created_at DESC);
CREATE INDEX ai_requests_function_name_idx ON ai_requests (function_name);
CREATE INDEX ai_requests_entity_idx        ON ai_requests (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's AI requests (for user-facing AI logs in future)
CREATE POLICY "ai_requests_select" ON ai_requests
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

-- No INSERT policy for authenticated users — only service role (edge functions) can insert.
-- No UPDATE or DELETE policy — append-only.
