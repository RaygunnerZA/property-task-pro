import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type {
  ReportDateRangePreset,
  ReportInstance,
  ReportSnapshot,
  ReportTemplateId,
} from "@/lib/reports/types";
import {
  createReportId,
  deleteReportInstance,
  finalizeReportInstance,
  getReportInstance,
  listReportInstances,
  upsertReportInstance,
} from "@/lib/reports/storage";
import { getReportTemplate } from "@/lib/reports/templates";
import { DATE_RANGE_OPTIONS } from "@/lib/reports/dateRange";

const listeners = new Set<() => void>();
let version = 0;

/** Cache getSnapshot results so useSyncExternalStore does not loop. */
const listCache = new Map<string, { version: number; list: ReportInstance[] }>();
const itemCache = new Map<
  string,
  { version: number; item: ReportInstance | null }
>();

function emitReportsChange() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function cachedList(orgId: string | null): ReportInstance[] {
  if (!orgId) return EMPTY_LIST;
  const hit = listCache.get(orgId);
  if (hit && hit.version === version) return hit.list;
  const list = listReportInstances(orgId);
  listCache.set(orgId, { version, list });
  return list;
}

function cachedItem(orgId: string | null, id: string | undefined): ReportInstance | null {
  if (!orgId || !id) return null;
  const key = `${orgId}:${id}`;
  const hit = itemCache.get(key);
  if (hit && hit.version === version) return hit.item;
  const item = getReportInstance(orgId, id);
  itemCache.set(key, { version, item });
  return item;
}

const EMPTY_LIST: ReportInstance[] = [];

/** Org-scoped report instances persisted in localStorage (until a DB model exists). */
export function useReportInstances() {
  const { orgId } = useActiveOrg();

  const instances = useSyncExternalStore(
    subscribe,
    () => cachedList(orgId),
    () => EMPTY_LIST
  );

  const save = useCallback((instance: ReportInstance) => {
    const next = upsertReportInstance(instance);
    emitReportsChange();
    return next;
  }, []);

  const remove = useCallback(
    (id: string) => {
      if (!orgId) return;
      deleteReportInstance(orgId, id);
      emitReportsChange();
    },
    [orgId]
  );

  const finalize = useCallback(
    (id: string, snapshot: ReportSnapshot) => {
      if (!orgId) return null;
      const next = finalizeReportInstance(orgId, id, snapshot);
      emitReportsChange();
      return next;
    },
    [orgId]
  );

  const createFromTemplate = useCallback(
    (input: {
      templateId: ReportTemplateId;
      propertyIds: string[];
      dateRangePreset: ReportDateRangePreset;
      scopeLabel: string;
      aiSummary: string;
    }) => {
      if (!orgId) throw new Error("No active organisation");
      const template = getReportTemplate(input.templateId);
      const period =
        DATE_RANGE_OPTIONS.find((o) => o.value === input.dateRangePreset)
          ?.label ?? input.dateRangePreset;
      const now = new Date().toISOString();
      const instance: ReportInstance = {
        id: createReportId(),
        orgId,
        templateId: input.templateId,
        title: template.defaultTitle(input.scopeLabel, period),
        propertyIds: input.propertyIds,
        dateRangePreset: input.dateRangePreset,
        status: "draft",
        aiSummary: input.aiSummary,
        notes: "",
        annotations: [],
        snapshot: null,
        createdAt: now,
        updatedAt: now,
        finalizedAt: null,
      };
      return save(instance);
    },
    [orgId, save]
  );

  const getById = useCallback(
    (id: string) => {
      if (!orgId) return null;
      return getReportInstance(orgId, id);
    },
    [orgId]
  );

  return useMemo(
    () => ({
      instances,
      save,
      remove,
      finalize,
      createFromTemplate,
      getById,
    }),
    [instances, save, remove, finalize, createFromTemplate, getById]
  );
}

export function useReportInstance(id: string | undefined) {
  const { orgId } = useActiveOrg();

  const instance = useSyncExternalStore(
    subscribe,
    () => cachedItem(orgId, id),
    () => null
  );

  return { instance, orgId };
}
