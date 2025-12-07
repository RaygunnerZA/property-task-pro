import { ReactNode } from "react";

interface OnboardingContainerProps {
  children: ReactNode;
  className?: string;
}

export function OnboardingContainer({ children, className }: OnboardingContainerProps) {
  return (
    <div className={`min-h-screen bg-[#F6F4F2] flex flex-col items-center justify-center p-6 relative overflow-hidden ${className || ''}`}>
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJuIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC44IiBudW1PY3RhdmVzPSI0IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI24pIi8+PC9zdmc+')]" />
      
      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  );
}
