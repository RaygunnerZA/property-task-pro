import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ScheduleState {
  selectedDate: Date;
  isDatePinned: boolean;
  setSelectedDate: (date: Date) => void;
  setSelectedDateOrToday: (date?: Date) => void;
}

const ScheduleContext = createContext<ScheduleState | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState<Date>(() => new Date());
  const [isDatePinned, setIsDatePinned] = useState(false);

  const setSelectedDate = useCallback((date: Date) => {
    setSelectedDateState(date);
    setIsDatePinned(true);
  }, []);

  const setSelectedDateOrToday = useCallback((date?: Date) => {
    setSelectedDateState(date ?? new Date());
    setIsDatePinned(!!date);
  }, []);

  const value = useMemo(
    () => ({
      selectedDate,
      isDatePinned,
      setSelectedDate,
      setSelectedDateOrToday,
    }),
    [selectedDate, isDatePinned, setSelectedDate, setSelectedDateOrToday]
  );

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useScheduleContext(): ScheduleState {
  const ctx = useContext(ScheduleContext);
  if (!ctx) {
    throw new Error("useScheduleContext must be used within a ScheduleProvider");
  }
  return ctx;
}

