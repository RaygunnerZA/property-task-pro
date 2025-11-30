import { DS, SectionTitle } from "../design-system/DesignSystem";

export default function WorkScreen() {
  const spaces = [
    { name: "To Do", tasks: 5, color: "#FF6B6B" },
    { name: "In Progress", tasks: 3, color: "#FFA94D" },
    { name: "Done", tasks: 12, color: "#51CF66" }
  ];

  return (
    <div className="space-y-4 pb-6">
      <SectionTitle>Task Board</SectionTitle>
      
      <div className="space-y-3">
        {spaces.map((space, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: space.color }}
                />
                <h3 className="text-[15px] font-semibold text-[#1A1A1A]">{space.name}</h3>
              </div>
              <span className="text-[13px] text-[#6F6F6F]">{space.tasks} tasks</span>
            </div>
            
            <div 
              className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md min-h-[100px]"
              style={{ boxShadow: DS.shadow.soft }}
            >
              <div className="text-[13px] text-[#6F6F6F]">
                Tasks will appear here
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
