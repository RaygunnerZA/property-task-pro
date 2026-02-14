-- Image Analysis Results: Store AI analysis output (OCR, detections)
-- Phase 2 will link to attachments after upload; attachment_id nullable for pre-upload flow

CREATE TABLE IF NOT EXISTS image_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  attachment_id UUID REFERENCES attachments(id) ON DELETE SET NULL,
  raw_response JSONB DEFAULT '{}',
  ocr_text TEXT,
  detected_objects JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE image_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_image_analysis_results_org ON image_analysis_results(org_id);
CREATE INDEX IF NOT EXISTS idx_image_analysis_results_attachment ON image_analysis_results(attachment_id) WHERE attachment_id IS NOT NULL;

CREATE POLICY "image_analysis_results_select" ON image_analysis_results FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "image_analysis_results_insert" ON image_analysis_results FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

COMMENT ON TABLE image_analysis_results IS 'AI analysis output: OCR text, detected objects. Phase 2 links to attachments post-upload.';
