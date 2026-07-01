-- Security Advisor: enable RLS on signal_recommendation_templates (global read-only catalog).
-- Maps signal subtype → recommended action; written only via migrations / service_role.
-- emit_signal (SECURITY DEFINER) is unaffected.

ALTER TABLE public.signal_recommendation_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signal_recommendation_templates_select_authenticated"
  ON public.signal_recommendation_templates;
CREATE POLICY "signal_recommendation_templates_select_authenticated"
  ON public.signal_recommendation_templates
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.signal_recommendation_templates TO authenticated;
