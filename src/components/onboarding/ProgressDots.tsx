interface ProgressDotsProps {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ease-out ${
            i === current
              ? "w-8 bg-[#FF6B6B]"
              : i < current
              ? "w-2 bg-[#FF6B6B]/50"
              : "w-2 bg-[#6D7480]/20"
          }`}
          style={{
            boxShadow: i === current 
              ? "inset 1px 1px 2px rgba(0,0,0,0.1), inset -1px -1px 2px rgba(255,255,255,0.7)"
              : "none"
          }}
        />
      ))}
    </div>
  );
}
