import { SectionTitle } from "../design-system/DesignSystem";
import PageSection from "../components/PageSection";

export default function ManageScreen() {
  return (
    <div className="space-y-6">
      <PageSection>
        <SectionTitle>Properties</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Your properties will appear here.</p>
      </PageSection>

      <PageSection>
        <SectionTitle>Spaces</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Spaces (rooms, zones) for each property.</p>
      </PageSection>

      <PageSection>
        <SectionTitle>People & Teams</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Users, vendors, teams, permissions.</p>
      </PageSection>
    </div>
  );
}
