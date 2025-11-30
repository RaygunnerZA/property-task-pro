export default function PageSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 bg-white/60 backdrop-blur-md rounded-[16px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]">
      {children}
    </div>
  );
}
