import { FileText } from "lucide-react";

export default function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="py-20 text-center text-[#666]">
      <div className="mb-3 opacity-30">
        <FileText className="h-16 w-16" />
      </div>
      <h3 className="text-[16px] font-medium">{title}</h3>
      {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
