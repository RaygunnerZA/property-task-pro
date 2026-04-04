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
  const { property, loading: propertyLoading } = useProperty(propertyId);

  const data = useMemo(() => {
    return tasksRaw
      .filter((row) => row.id)
      .map((row) => mapTasksViewToPropertyTask(row));
  }, [tasksRaw]);

  const header: PropertyHeader | null = property
    ? {
        id: property.id,
        address: property.address,
        nickname: property.nickname,
      }
    : null;

  return {
    data,
    property: header,
    loading: (!!propertyId && tasksLoading) || (!!propertyId && propertyLoading),
  };
}
