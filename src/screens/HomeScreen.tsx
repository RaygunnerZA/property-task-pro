import { DS, SectionTitle } from "../design-system/DesignSystem";

export default function HomeScreen() {
  return (
    <div className="space-y-4 pb-6">
      {/* Quick Stats */}
      <section>
        <SectionTitle>Overview</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div 
            className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md"
            style={{ boxShadow: DS.shadow.soft }}
          >
            <div className="text-[13px] text-[#6F6F6F] mb-1">Open Tasks</div>
            <div className="text-[24px] font-bold text-[#1A1A1A]">12</div>
          </div>
          <div 
            className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md"
            style={{ boxShadow: DS.shadow.soft }}
          >
            <div className="text-[13px] text-[#6F6F6F] mb-1">Due Today</div>
            <div className="text-[24px] font-bold text-[#FF6B6B]">3</div>
          </div>
        </div>
      </section>

      {/* Schedule Snippet */}
      <section>
        <SectionTitle>Today's Schedule</SectionTitle>
        <div 
          className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md space-y-3"
          style={{ boxShadow: DS.shadow.soft }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium text-[#1A1A1A]">Inspect fire alarms</div>
              <div className="text-[13px] text-[#6F6F6F]">Building A</div>
            </div>
            <div className="text-[13px] text-[#0E8388] font-semibold">10:00 AM</div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium text-[#1A1A1A]">HVAC maintenance</div>
              <div className="text-[13px] text-[#6F6F6F]">Building B</div>
            </div>
            <div className="text-[13px] text-[#0E8388] font-semibold">2:00 PM</div>
          </div>
        </div>
      </section>

      {/* Next Tasks */}
      <section>
        <SectionTitle>Next Tasks</SectionTitle>
        <div className="space-y-2">
          {[
            { title: "Review tenant request", property: "Oak Residences", priority: "High" },
            { title: "Order cleaning supplies", property: "Main Office", priority: "Medium" },
            { title: "Update lease documents", property: "Pine Apartments", priority: "Low" }
          ].map((task, i) => (
            <div
              key={i}
              className="p-3 rounded-[10px] bg-white/60 backdrop-blur-md flex items-center justify-between"
              style={{ boxShadow: DS.shadow.soft }}
            >
              <div>
                <div className="text-[15px] font-medium text-[#1A1A1A]">{task.title}</div>
                <div className="text-[13px] text-[#6F6F6F]">{task.property}</div>
              </div>
              <div 
                className={`text-[11px] px-2 py-1 rounded-md font-semibold ${
                  task.priority === "High" ? "bg-red-100 text-red-700" :
                  task.priority === "Medium" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-700"
                }`}
              >
                {task.priority}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
