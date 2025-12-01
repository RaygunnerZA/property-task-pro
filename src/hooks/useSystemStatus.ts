import { useSystemStatusContext } from "@/providers/SystemStatusProvider";

export function useSystemStatus() {
  return useSystemStatusContext();
}
