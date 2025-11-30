import { SectionTitle } from "../design-system/DesignSystem";
import PageSection from "../components/PageSection";

export default function WorkScreen() {
  return (
    <div className="space-y-6">
      <PageSection>
        <SectionTitle>Tasks</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Your task list will appear here.</p>
      </PageSection>

      <PageSection>
        <SectionTitle>Messages</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Task-related messages will show here.</p>
      </PageSection>

      <PageSection>
        <SectionTitle>Reminders</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Scheduled reminders appear here.</p>
      </PageSection>
    </div>
  );
}
