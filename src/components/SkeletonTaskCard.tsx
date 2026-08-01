export default function SkeletonTaskCard() {
  return (
    <div className="p-4 rounded-card bg-card/40 shadow-e1 animate-pulse">
      <div className="h-4 w-1/3 bg-foreground/10 rounded mb-3"></div>
      <div className="h-3 w-1/4 bg-foreground/10 rounded"></div>
    </div>
  );
}
