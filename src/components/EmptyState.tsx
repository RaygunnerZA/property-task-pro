export default function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="py-20 text-center text-[#666]">
      <div className="text-6xl mb-3 opacity-30">🗒️</div>
      <h3 className="text-[16px] font-medium">{title}</h3>
      {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
