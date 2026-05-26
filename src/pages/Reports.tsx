import { StandardPage } from "@/components/design-system/StandardPage";
import { BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <StandardPage
      title="Reports"
      icon={<BarChart3 className="h-6 w-6" />}
      subtitle="Portfolio insights and exports — coming soon."
    >
      <div className="rounded-xl bg-card/70 p-6 shadow-e1 text-sm text-muted-foreground">
        Reporting dashboards will live here. Compliance exports remain under Records for now.
      </div>
    </StandardPage>
  );
}
