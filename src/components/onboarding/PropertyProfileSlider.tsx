import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { PropertyProfileCard } from "@/components/onboarding/PropertyProfileCard";
import {
  PROPERTY_PROFILE_OPTIONS,
  type PropertyProfileId,
} from "@/lib/propertyProfiles";
import { cn } from "@/lib/utils";

interface PropertyProfileSliderProps {
  confirmedId: PropertyProfileId | null;
  onConfirm: (id: PropertyProfileId) => void;
  onSlideChange?: () => void;
}

const EMBLA_OPTS = {
  align: "center" as const,
  loop: false,
  containScroll: "trimSnaps" as const,
  dragFree: false,
  skipSnaps: false,
  startIndex: 0,
  dragThreshold: 22,
};

const WHEEL_THRESHOLD = 110;
const WHEEL_DELTA_SCALE = 0.45;

const VIEWPORT_DRAG_CLASS =
  "touch-pan-x cursor-grab select-none overscroll-x-contain active:cursor-grabbing [-webkit-user-drag:none]";

export function PropertyProfileSlider({
  confirmedId,
  onConfirm,
  onSlideChange,
}: PropertyProfileSliderProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const wheelAccumRef = useRef(0);

  const skipNextSelectRef = useRef(false);

  useEffect(() => {
    if (!api) return;
    skipNextSelectRef.current = true;
    api.scrollTo(0, false);
    setActiveIndex(0);
  }, [api]);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setActiveIndex(api.selectedScrollSnap());
      if (skipNextSelectRef.current) {
        skipNextSelectRef.current = false;
        return;
      }
      onSlideChange?.();
    };

    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSlideChange]);

  useEffect(() => {
    if (!api) return;
    const node = api.rootNode();

    const onWheel = (event: WheelEvent) => {
      const { deltaX, deltaY } = event;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

      event.preventDefault();
      wheelAccumRef.current += deltaX * WHEEL_DELTA_SCALE;

      if (wheelAccumRef.current >= WHEEL_THRESHOLD) {
        api.scrollNext();
        wheelAccumRef.current = 0;
      } else if (wheelAccumRef.current <= -WHEEL_THRESHOLD) {
        api.scrollPrev();
        wheelAccumRef.current = 0;
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [api]);

  const scrollToIndex = (index: number) => {
    api?.scrollTo(index);
  };

  const handleCardActivate = () => {
    const option = PROPERTY_PROFILE_OPTIONS[activeIndex];
    if (option) {
      onConfirm(option.id);
    }
  };

  const navButtonClass = (enabled: boolean) =>
    cn(
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity",
      enabled
        ? "text-[#EB6834] hover:opacity-80"
        : "text-[#EB6834]/35 pointer-events-none"
    );

  const chevronClass = "h-9 w-9";

  return (
    <div className="mb-6" role="radiogroup" aria-label="Property profile">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous property type"
          disabled={activeIndex <= 0}
          onClick={() => api?.scrollPrev()}
          className={navButtonClass(activeIndex > 0)}
        >
          <ChevronLeft className={chevronClass} strokeWidth={2.5} aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <Carousel setApi={setApi} opts={EMBLA_OPTS} className="w-full">
            <CarouselContent
              className="ml-0"
              viewportClassName={VIEWPORT_DRAG_CLASS}
            >
              {PROPERTY_PROFILE_OPTIONS.map((option, index) => (
                <CarouselItem key={option.id} className="basis-full pl-0">
                  <PropertyProfileCard
                    option={option}
                    isActive={activeIndex === index}
                    isConfirmed={confirmedId === option.id && activeIndex === index}
                    onActivate={handleCardActivate}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        <button
          type="button"
          aria-label="Next property type"
          disabled={activeIndex >= PROPERTY_PROFILE_OPTIONS.length - 1}
          onClick={() => api?.scrollNext()}
          className={navButtonClass(activeIndex < PROPERTY_PROFILE_OPTIONS.length - 1)}
        >
          <ChevronRight className={chevronClass} strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {PROPERTY_PROFILE_OPTIONS.map((option, index) => (
          <button
            key={option.id}
            type="button"
            aria-label={`Go to ${option.label}`}
            aria-current={activeIndex === index ? "true" : undefined}
            onClick={() => scrollToIndex(index)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              activeIndex === index ? "w-6 bg-[#8EC9CE]" : "w-1.5 bg-[#6D7480]/25"
            )}
          />
        ))}
      </div>
    </div>
  );
}
