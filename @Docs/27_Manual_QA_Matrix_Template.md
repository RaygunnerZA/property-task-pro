# Manual QA matrix — schema, `task_status`, and org identity

**Purpose:** Satisfy precondition **0.3** in [`Rollout_Checklist_1-2_Sprints.md`](./Rollout_Checklist_1-2_Sprints.md): after any change to **`task_status`**, org resolution, RLS, or materialized views that feed the task list, run this matrix and **paste the completed table (or “N/A per row”) in the PR description** with your initials and date.

**When required:** Any PR touching migrations or client code that changes how tasks are filtered, displayed, or attributed to an org (including `useActiveOrg` / membership order).

| # | Scenario | Steps | Expected | Pass / N/A | Tester / date |
|---|----------|-------|----------|------------|----------------|
| 1 | **Vendor / contractor** (if applicable) | Open contractor-facing task; confirm status badge and actions match product rules | No 500s; status labels match `03_Data_Model` | | |
| 2 | **Manager — task list** | Manager org: open main task list / workbench; create and complete a task if schema touched | Tasks load; filters apply; completed task appears in correct column/filter | | |
| 3 | **Filters / badges** | Apply priority and status filters; open a task with milestone / compliance flags if relevant | Badges match DB; clearing filters restores full list | | |
| 4 | **Staff vs assigned properties** (if staff user available) | Staff user: list tasks; attempt property outside assignment | RLS hides or read-only behaviour per product | | |
| 5 | **Materialized views** (only if PR touches `*_view` or refresh) | Note migration name; run refresh job or wait for cron; reload UI | Counts or lists match underlying tables within acceptable lag | | |
| 6 | **Org switch risk** (future) | If multi-org selector exists: switch org, reload task list | Queries use new `org_id`; no stale data without refresh | | |

**Sign-off line for PRs:**  
`QA matrix 0.3: executed rows ___ / N/A rows ___ ; initials ___ ; date ___`

---

**Revision:** Extend rows when new surfaces (e.g. Records hub) gain schema coupling.
