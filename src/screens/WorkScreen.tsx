import { useState } from "react";
import WorkSegmentControl from "../components/WorkSegmentControl";
import TaskList from "../components/TaskList";
import MessageList from "../components/MessageList";
import ReminderList from "../components/ReminderList";

export default function WorkScreen() {
  const [segment, setSegment] = useState<"tasks" | "messages" | "reminders">("tasks");

  return (
    <div className="space-y-4">
      <WorkSegmentControl value={segment} onChange={setSegment} />

      {segment === "tasks" && <TaskList />}
      {segment === "messages" && <MessageList />}
      {segment === "reminders" && <ReminderList />}
    </div>
  );
}
