-- Content workflow integrity: remove legacy placeholder outputs and unstuck generating statuses.

-- Placeholder outputs were seeded at topic create before sequential workflow.
DELETE FROM public.content_outputs o
USING public.content_topics t
WHERE o.topic_id = t.id
  AND COALESCE(t.brief->>'approval_status', 'none') <> 'approved'
  AND o.body IS NULL
  AND (o.title IS NULL OR btrim(o.title) = '')
  AND o.status = 'draft';

-- Topics with a visible SEO proposal should not remain on generating_seo.
UPDATE public.content_topics t
SET workflow_status = 'seo_review',
    updated_at = now()
WHERE t.workflow_status = 'generating_seo'
  AND COALESCE(t.seo->>'last_error', '') = ''
  AND (
    btrim(COALESCE(t.seo #>> '{current,primary_keyword}', '')) <> ''
    OR btrim(COALESCE(t.seo #>> '{current,primary_search_theme}', '')) <> ''
  );

UPDATE public.content_topics t
SET workflow_status = 'brief_review',
    updated_at = now()
WHERE t.workflow_status = 'generating_brief'
  AND COALESCE(t.brief->>'last_error', '') = ''
  AND btrim(COALESCE(t.brief #>> '{current,working_title}', t.brief #>> '{current,title}', '')) <> '';
