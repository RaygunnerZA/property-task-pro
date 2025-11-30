export default function SkeletonTaskCard() {
  return (
    <div className="p-4 rounded-[16px] bg-white/40 backdrop-blur-md animate-pulse">
      <div className="h-4 w-1/3 bg-black/10 rounded mb-3"></div>
      <div className="h-3 w-1/4 bg-black/10 rounded"></div>
    </div>
  );
}
