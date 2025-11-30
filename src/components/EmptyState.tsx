interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export default function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <div className="p-8 bg-white/60 backdrop-blur-md rounded-[16px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)] text-center">
      <p className="text-[15px] font-semibold text-[#1A1A1A] mb-1">{title}</p>
      {subtitle && <p className="text-[13px] text-[#6F6F6F]">{subtitle}</p>}
    </div>
  );
}
