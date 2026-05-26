import { StandardPage } from "@/components/design-system/StandardPage";
import { BookOpen } from "lucide-react";

export default function Knowledge() {
  return (
    <StandardPage
      title="Knowledge"
      icon={<BookOpen className="h-6 w-6" />}
      subtitle="Policies, playbooks, and property know-how — coming soon."
    >
      <div className="rounded-xl bg-card/70 p-6 shadow-e1 text-sm text-muted-foreground">
        Knowledge base and search will live here.
      </div>
    </StandardPage>
  );
}
