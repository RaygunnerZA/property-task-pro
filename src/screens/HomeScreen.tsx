import { SectionTitle } from "@/components/filla/SectionTitle";
import PageSection from "../components/PageSection";

export default function HomeScreen() {
  return (
    <div className="space-y-6">
      <PageSection>
        <SectionTitle>Today</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Your upcoming tasks and reminders will appear here.</p>
      </PageSection>

      <PageSection>
        <SectionTitle>Recent Activity</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Messages and recent updates will show here.</p>
      </PageSection>
    </div>
  );
}
