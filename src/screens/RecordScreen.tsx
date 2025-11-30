import { DS, SectionTitle } from "../design-system/DesignSystem";

export default function RecordScreen() {
  const categories = [
    { icon: "📄", title: "Documents", count: 45, color: "#0E8388" },
    { icon: "✅", title: "Compliance", count: 12, color: "#51CF66" },
    { icon: "📊", title: "Reports", count: 8, color: "#FFA94D" },
    { icon: "📚", title: "Library", count: 23, color: "#748FFC" }
  ];

  return (
    <div className="space-y-4 pb-6">
      <SectionTitle>Records & History</SectionTitle>
      
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat, i) => (
          <button
            key={i}
            className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md text-left transition-all active:scale-98"
            style={{ boxShadow: DS.shadow.soft }}
          >
            <div className="text-[32px] mb-2">{cat.icon}</div>
            <div className="text-[15px] font-semibold text-[#1A1A1A] mb-1">{cat.title}</div>
            <div 
              className="text-[13px] font-medium"
              style={{ color: cat.color }}
            >
              {cat.count} items
            </div>
          </button>
        ))}
      </div>

      <section>
        <SectionTitle>Recent Activity</SectionTitle>
        <div 
          className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md space-y-3"
          style={{ boxShadow: DS.shadow.soft }}
        >
          {[
            { action: "Document uploaded", item: "Lease Agreement - Unit 204", time: "2 hours ago" },
            { action: "Compliance check", item: "Fire Safety Inspection", time: "Yesterday" },
            { action: "Report generated", item: "Monthly Maintenance Summary", time: "2 days ago" }
          ].map((activity, i) => (
            <div key={i} className="flex justify-between items-start">
              <div>
                <div className="text-[15px] font-medium text-[#1A1A1A]">{activity.action}</div>
                <div className="text-[13px] text-[#6F6F6F]">{activity.item}</div>
              </div>
              <div className="text-[11px] text-[#6F6F6F]">{activity.time}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
