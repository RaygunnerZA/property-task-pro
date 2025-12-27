# TACTICAL BUILD ROADMAP (Current Focus)

**Goal:** Turn the Skeleton into a Rich Application.

**PHASE A: THE STORAGE ENGINE (Attachments)**
*   **Target:** `src/components/attachments/GlobalDropZone.tsx`
*   **Logic:**
    1.  Create Storage Bucket `inbox` (Public upload, Private read).
    2.  Create Table `compliance_sources` (if missing).
    3.  Build the Drag-and-Drop UI (Neomorphic).
    4.  Connect Drop -> Upload -> Database Record.

**PHASE B: THE TASK DETAIL PANEL (Dual-Pane UX)**
*   **Target:** `src/components/tasks/TaskDetailPanel.tsx`
*   **Logic:**
    1.  Build the Right-Side Slide-Over Panel.
    2.  Implement the 4 Tabs: Summary, Messaging, Files, Logs.
    3.  Connect "Files Tab" to the Storage Engine from Phase A.
    4.  Connect "Summary Tab" to the `task_spaces` / `task_teams` schema.

**PHASE C: THE CONTEXT NAVIGATION**
*   **Target:** `src/app/properties/[id]/page.tsx`
*   **Logic:**
    1.  Replace the generic page with the "Context Header".
    2.  Show tabs: Overview, Tasks, Assets, Compliance.
    3.  Ensure clicking a Task in the "Tasks Tab" opens the Panel from Phase B.

**RULE:** Do not implement JWT Claims or Advanced Identity logic yet. Stick to the existing `useActiveOrg` + `check_user_org_membership` security model.