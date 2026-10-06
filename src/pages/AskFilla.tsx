import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StandardPage } from "@/components/design-system/StandardPage";
import { Button } from "@/components/ui/button";
import { useAssistantContext } from "@/contexts/AssistantContext";

/** `/assistant` opens the existing Filla AI panel. It is not a primary nav destination. */
export default function AskFillaPage() {
  const { openAssistant } = useAssistantContext();
  const navigate = useNavigate();

  useEffect(() => {
    openAssistant();
  }, [openAssistant]);

  return (
    <StandardPage
      title="Ask Filla"
      subtitle="The assistant opens over your workspace."
      headerVariant="activity"
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => openAssistant()}>
          Open assistant
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate("/home")}>
          Back to Home
        </Button>
      </div>
    </StandardPage>
  );
}
