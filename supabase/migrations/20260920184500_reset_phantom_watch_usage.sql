-- Credit back phantom search usage from the first knowledge-watch-run
-- implementation, which billed free inventory checks as searches.

UPDATE public.knowledge_watch_usage
SET
  searches_used = 0,
  pages_used = 0,
  tokens_used = 0,
  cost_units_used = 0,
  updated_at = now()
WHERE period_ym = to_char(timezone('utc', now()), 'YYYY-MM');
