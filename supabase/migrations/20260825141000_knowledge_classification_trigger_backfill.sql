-- Backfill legal_status from imported classification; fix trigger_type from concatenated fields.

-- 1) Classification: copy attributes.classification → legal_status when legal_status empty.
UPDATE public.knowledge k
SET
  attributes = k.attributes || jsonb_build_object(
    'legal_status',
    nullif(btrim(k.attributes->>'classification'), '')
  ),
  updated_at = now()
WHERE nullif(btrim(coalesce(k.attributes->>'legal_status', '')), '') IS NULL
  AND nullif(btrim(coalesce(k.attributes->>'classification', '')), '') IS NOT NULL;

-- 2) Recompute trigger_type from frequency/timing/applies_when/event_trigger (concatenated).
UPDATE public.knowledge k
SET
  attributes = (k.attributes - 'trigger_type') || jsonb_build_object(
    'trigger_type',
    CASE
      WHEN COALESCE(k.attributes->>'event_trigger', '') ~* 'event'
        OR (
          COALESCE(k.attributes->>'applies_when', '') || ' ' ||
          COALESCE(k.attributes->>'timing', '') || ' ' ||
          COALESCE(k.attributes->>'frequency', '')
        ) ~* 'before|prior|pre-work|consent|notice|when (planning|starting)|work planned|tree work|present'
        THEN 'event_driven'
      WHEN (
          COALESCE(k.attributes->>'applies_when', '') || ' ' ||
          COALESCE(k.attributes->>'timing', '') || ' ' ||
          COALESCE(k.attributes->>'frequency', '') || ' ' ||
          COALESCE(k.attributes->>'trigger_type', '')
        ) ~* 'threshold|exceed|above|below|limit|CO2|tonne'
        THEN 'threshold_based'
      WHEN (
          COALESCE(k.attributes->>'applies_when', '') || ' ' ||
          COALESCE(k.attributes->>'timing', '') || ' ' ||
          COALESCE(k.attributes->>'frequency', '')
        ) ~* 'ongoing|continuous|always|at all times|maintain|replace by'
        THEN 'continuous'
      WHEN (
          COALESCE(k.attributes->>'applies_when', '') || ' ' ||
          COALESCE(k.attributes->>'timing', '') || ' ' ||
          COALESCE(k.attributes->>'frequency', '')
        ) ~* 'annual|yearly|monthly|quarter|every[[:space:]]+[0-9]|recurring|schedule|interval'
        THEN 'scheduled'
      WHEN nullif(btrim(COALESCE(k.attributes->>'frequency', '')), '') IS NOT NULL
        THEN 'scheduled'
      WHEN nullif(btrim(COALESCE(k.attributes->>'applies_when', '')), '') IS NOT NULL
        THEN 'event_driven'
      ELSE NULL
    END
  ),
  updated_at = now()
WHERE
  nullif(btrim(COALESCE(k.attributes->>'applies_when', '')), '') IS NOT NULL
  OR nullif(btrim(COALESCE(k.attributes->>'frequency', '')), '') IS NOT NULL
  OR nullif(btrim(COALESCE(k.attributes->>'timing', '')), '') IS NOT NULL
  OR nullif(btrim(COALESCE(k.attributes->>'event_trigger', '')), '') IS NOT NULL;

-- Drop null trigger_type keys
UPDATE public.knowledge
SET attributes = attributes - 'trigger_type'
WHERE attributes ? 'trigger_type' AND attributes->>'trigger_type' IS NULL;
