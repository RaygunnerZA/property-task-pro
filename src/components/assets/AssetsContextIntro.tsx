/**
 * Left-rail heading art for Assets — same illustration language as space/plant cards.
 */
export function AssetsContextIntro({ scoped }: { scoped: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-center pt-0.5">
        <img
          src="/spaces/mini-cards/plant-room-2.png"
          alt=""
          draggable={false}
          decoding="async"
          className="h-[92px] w-auto max-w-full object-contain drop-shadow-sm"
        />
      </div>
      <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
        {scoped
          ? "Equipment, plant, and fixtures on this property."
          : "Equipment and plant across your properties."}
      </p>
    </div>
  );
}
