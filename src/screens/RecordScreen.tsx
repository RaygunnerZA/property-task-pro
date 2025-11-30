import { SectionTitle } from "../design-system/DesignSystem";
import PageSection from "../components/PageSection";

export default function RecordScreen() {
  return (
    <div className="space-y-6">
      <PageSection>
        <SectionTitle>Compliance</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Certificates, inspections and compliance status.</p>
      </PageSection>

      <PageSection>
        <SectionTitle>Documents</SectionTitle>
        <p className="text-[#6F6F6F] text-sm">Plans, manuals, warranties and uploaded records.</p>
      </PageSection>
    </div>
  );
}
