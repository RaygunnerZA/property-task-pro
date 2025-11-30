import { useState } from "react";
import WorkSegmentControl from "../components/WorkSegmentControl";
import TaskList from "../components/TaskList";
import MessageList from "../components/MessageList";
import ReminderList from "../components/ReminderList";
import { useOrganisationId } from "../state/useOrganisationId";

export default function WorkScreen() {
  const [segment, setSegment] = useState<"tasks" | "messages" | "reminders">("tasks");
  const orgId = useOrganisationId();

  return (
    <div className="space-y-4">
      <WorkSegmentControl value={segment} onChange={setSegment} />

      {segment === "tasks" && <TaskList orgId={orgId} />}
      {segment === "messages" && <MessageList orgId={orgId} />}
      {segment === "reminders" && <ReminderList orgId={orgId} />}
    </div>
  );
}
