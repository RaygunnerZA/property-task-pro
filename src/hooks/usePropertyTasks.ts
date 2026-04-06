import { useMemo } from "react";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useProperty } from "@/hooks/property/useProperty";
import {
  mapTasksViewToPropertyTask,
  type PropertyTaskCardModel,
} from "@/utils/mapTasksViewToCards";

export type PropertyTask = PropertyTaskCardModel;

interface PropertyHeader {
  id: string;
  address: string;
  nickname?: string | null;
}

export function usePropertyTasks(propertyId: string | undefined) {
  const { data: tasksRaw = [], isLoading: tasksLoading } = useTasksQuery(
    propertyId,
    { enabled: !!propertyId }
  );
  const { property: propertyRow, loading: propertyLoading } = useProperty(propertyId);

  const data = useMemo(() => {
    return tasksRaw
      .filter((row) => row.id)
      .map((row) => mapTasksViewToPropertyTask(row));
  }, [tasksRaw]);

  const header: PropertyHeader | null = propertyRow
    ? {
        id: propertyRow.id,
        address: propertyRow.address,
        nickname: propertyRow.nickname,
      }
    : null;

  return {
    data,
    property: header,
    /** Full row for UI (e.g. property colour on scoped screens). */
    propertyRow,
    loading: (!!propertyId && tasksLoading) || (!!propertyId && propertyLoading),
  };
}
