import { Link } from "react-router-dom";
import { StandardPage } from "@/components/design-system/StandardPage";

const TOPICS = [
  {
    title: "Review an upload",
    body: "Open Home and use Uploads to review. Each file shows a preview, the type we read, and the signals to confirm before you file it.",
  },
  {
    title: "Work a task",
    body: "Tasks lists what is open. Open a task to tick the checklist, add a step, and mark it in progress. Activity keeps the record of changes.",
  },
  {
    title: "File a record",
    body: "Records holds certificates and documents. Add record asks for the type, location, and expiry, then the file. Sample pictures are not real files.",
  },
] as const;

export default function HelpPage() {
  return (
    <StandardPage
      title="Help"
      subtitle="Short guides for the work you do in Filla."
      headerVariant="activity"
    >
      <ul className="space-y-3">
        {TOPICS.map((topic) => (
          <li key={topic.title} className="rounded-xl bg-card/80 px-4 py-3 shadow-e1">
            <h2 className="text-sm font-semibold text-foreground">{topic.title}</h2>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{topic.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Account, team, and billing live in{" "}
        <Link to="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
          Settings
        </Link>
        .
      </p>
    </StandardPage>
  );
}
