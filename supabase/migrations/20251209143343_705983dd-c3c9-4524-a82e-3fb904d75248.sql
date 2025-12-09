-- Fix: Set view to SECURITY INVOKER to respect RLS of querying user
ALTER VIEW public.checklist_templates_with_items SET (security_invoker = true);