import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, formatISO } from "date-fns";
import {
  DEV_ROLEPLAY_CONVERSATION_REF,
  DEV_ROLEPLAY_MARKER,
} from "@/lib/dev/testPersonas";
import { resolvePersonaMembers } from "@/lib/dev/resolvePersonaMembers";

export interface SeedRolePlayResult {
  created: boolean;
  tasksCreated: number;
  messagesCreated: number;
  taskIds: string[];
  conversationId: string | null;
  missingPersonas: string[];
}

async function pickPropertyId(
  supabase: SupabaseClient,
  orgId: string,
  propertyId?: string
): Promise<string | null> {
  if (propertyId) return propertyId;

  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id ?? null;
}

export async function seedRolePlayScenario(
  supabase: SupabaseClient,
  orgId: string,
  options?: { propertyId?: string }
): Promise<SeedRolePlayResult> {
  if (!import.meta.env.DEV && import.meta.env.VITE_APP_DEV_BUILD !== "true") {
    throw new Error("seedRolePlayScenario is only available in dev builds");
  }

  const propertyId = await pickPropertyId(supabase, orgId, options?.propertyId);
  if (!propertyId) {
    throw new Error("No property found in this org — add a property before seeding.");
  }

  const { resolved, missing } = await resolvePersonaMembers(supabase, orgId);
  const missingLabels = missing.map((p) => p.testId);

  const carol = resolved["test-03"];
  const alice = resolved["test-01"];
  const bob = resolved["test-02"];
  const emma = resolved["test-05"];
  const frank = resolved["test-06"];

  if (!carol || !alice || !emma) {
    return {
      created: false,
      tasksCreated: 0,
      messagesCreated: 0,
      taskIds: [],
      conversationId: null,
      missingPersonas: missingLabels,
    };
  }

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("org_id", orgId)
    .like("title", `${DEV_ROLEPLAY_MARKER}%`)
    .limit(1);

  if (existingTasks?.length) {
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("org_id", orgId)
      .eq("external_ref", DEV_ROLEPLAY_CONVERSATION_REF)
      .maybeSingle();

    return {
      created: false,
      tasksCreated: 0,
      messagesCreated: 0,
      taskIds: existingTasks.map((t) => t.id),
      conversationId: existingConv?.id ?? null,
      missingPersonas: missingLabels,
    };
  }

  const dueBase = addDays(new Date(), 3);
  const taskSpecs = [
    {
      title: `${DEV_ROLEPLAY_MARKER} Boiler inspection`,
      description: "Manager assigned — staff completes checklist and replies in thread.",
      assigned_user_id: emma?.userId ?? alice.userId,
      priority: "high" as const,
    },
    {
      title: `${DEV_ROLEPLAY_MARKER} Handoff — lobby repaint`,
      description: "Alice starts; Bob picks up after materials arrive.",
      assigned_user_id: alice.userId,
      priority: "normal" as const,
    },
    {
      title: `${DEV_ROLEPLAY_MARKER} Vendor delivery window`,
      description: "Supplier coordination on active job.",
      assigned_user_id: frank?.userId ?? bob?.userId ?? alice.userId,
      priority: "normal" as const,
    },
  ];

  const taskIds: string[] = [];
  for (const spec of taskSpecs) {
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        org_id: orgId,
        property_id: propertyId,
        title: spec.title,
        description: spec.description,
        status: "open",
        priority: spec.priority,
        assigned_user_id: spec.assigned_user_id,
        due_date: formatISO(dueBase, { representation: "date" }),
      })
      .select("id")
      .single();

    if (error) throw error;
    taskIds.push(task.id);
  }

  const primaryTaskId = taskIds[0]!;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({
      org_id: orgId,
      property_id: propertyId,
      task_id: primaryTaskId,
      channel: "task",
      subject: `${DEV_ROLEPLAY_MARKER} Task thread`,
      external_ref: DEV_ROLEPLAY_CONVERSATION_REF,
    })
    .select("id")
    .single();

  if (convError) throw convError;

  const thread: Array<{
    authorUserId: string;
    authorName: string;
    authorRole: string;
    body: string;
    direction: "inbound" | "outbound";
  }> = [
    {
      authorUserId: carol.userId,
      authorName: carol.displayName,
      authorRole: "manager",
      body: "Emma — can you confirm the boiler pressure reading before end of day?",
      direction: "outbound",
    },
    {
      authorUserId: (emma ?? alice).userId,
      authorName: (emma ?? alice).displayName,
      authorRole: emma ? "staff" : "staff",
      body: "Reading is 1.2 bar, within range. Photo will be on the task shortly.",
      direction: "inbound",
    },
  ];

  if (bob) {
    thread.push({
      authorUserId: bob.userId,
      authorName: bob.displayName,
      authorRole: "staff",
      body: "I can cover the lobby repaint handoff once materials land — ping me in this thread.",
      direction: "inbound",
    });
  }

  if (frank) {
    thread.push({
      authorUserId: frank.userId,
      authorName: frank.displayName,
      authorRole: "vendor",
      body: "Delivery window confirmed: Thursday 08:00–10:00. Reply here if access codes changed.",
      direction: "inbound",
    });
  }

  thread.push({
    authorUserId: carol.userId,
    authorName: carol.displayName,
    authorRole: "manager",
    body: "Thanks all — switching test users in DevTools will show each perspective on this thread.",
    direction: "outbound",
  });

  const messageRows = thread.map((m) => ({
    org_id: orgId,
    conversation_id: conversation.id,
    author_user_id: m.authorUserId,
    author_name: m.authorName,
    author_role: m.authorRole,
    body: m.body,
    source: "dev_seed",
    direction: m.direction,
    raw_payload: { scenario: DEV_ROLEPLAY_CONVERSATION_REF },
  }));

  const { error: msgError } = await supabase.from("messages").insert(messageRows);
  if (msgError) throw msgError;

  return {
    created: true,
    tasksCreated: taskIds.length,
    messagesCreated: messageRows.length,
    taskIds,
    conversationId: conversation.id,
    missingPersonas: missingLabels,
  };
}
