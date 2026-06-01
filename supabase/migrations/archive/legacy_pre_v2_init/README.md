# Legacy pre–`filla_v2_init` migrations (archived)

These SQL files ran **before** `20251218201715_filla_v2_init.sql` in filename order but assume tables that init creates (`attachments`, full `properties` schema, etc.).

They are **not** applied by `supabase db push` anymore (moved out of the active migrations folder).

Their changes are superseded by:

- `20251218201715_filla_v2_init.sql` and later migrations
- Follow-ups such as `20251229170924_add_property_owner_contact.sql`, `20260212200000_add_attachments_ocr.sql`, etc.

Keep for history only. Do not move back into `supabase/migrations/` unless you understand the ordering conflict.
