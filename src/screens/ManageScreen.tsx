import { DS, SectionTitle } from "../design-system/DesignSystem";

export default function ManageScreen() {
  const sections = [
    { icon: "🏢", title: "Properties", description: "Manage your buildings and units" },
    { icon: "📦", title: "Spaces", description: "Organize rooms and areas" },
    { icon: "👥", title: "People", description: "Team members and contacts" },
    { icon: "🔧", title: "Vendors", description: "Service providers" },
    { icon: "📋", title: "Templates", description: "Task templates and checklists" },
    { icon: "⚙️", title: "Settings", description: "Organization preferences" }
  ];

  return (
    <div className="space-y-4 pb-6">
      <SectionTitle>Management</SectionTitle>
      
      <div className="space-y-2">
        {sections.map((section, i) => (
          <button
            key={i}
            className="w-full p-4 rounded-[16px] bg-white/60 backdrop-blur-md flex items-center gap-4 text-left transition-all active:scale-98"
            style={{ boxShadow: DS.shadow.soft }}
          >
            <div className="text-[32px]">{section.icon}</div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-[#1A1A1A]">{section.title}</div>
              <div className="text-[13px] text-[#6F6F6F]">{section.description}</div>
            </div>
            <div className="text-[#6F6F6F]">›</div>
          </button>
        ))}
      </div>
    </div>
  );
}
