import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_CREATIVE,
  normalizeCreative,
  normalizeSurfaces,
  type SeasonalPackageAdminItem,
  type SeasonalPackageAdminRow,
  type SeasonalPackageCreative,
  type SeasonalSurfaceId,
} from "@/lib/seasonal/seasonalPackageRelease";
import type { SeasonalPackageStatus, SeasonalSeason } from "@/types/seasonalPackage";

export type AdminSeasonalPackageListRow = SeasonalPackageAdminRow & {
  item_count: number;
  items_ready_count: number;
};

export type AdminSeasonalPackageDetail = {
  package: SeasonalPackageAdminRow;
  items: SeasonalPackageAdminItem[];
};

function mapListRow(raw: Record<string, unknown>): AdminSeasonalPackageListRow {
  return {
    id: String(raw.id),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    introduction: String(raw.introduction ?? ""),
    season: (raw.season as SeasonalSeason) ?? "autumn",
    hemisphere: (raw.hemisphere as "northern" | "southern" | "either") ?? "northern",
    display_from: String(raw.display_from ?? ""),
    display_until: String(raw.display_until ?? ""),
    urgency_band: (raw.urgency_band as "timely" | "evergreen") ?? "timely",
    prep_window_label: (raw.prep_window_label as string | null) ?? null,
    applicability: (raw.applicability as Record<string, unknown>) ?? {},
    status: (raw.status as SeasonalPackageStatus) ?? "draft",
    version: Number(raw.version ?? 1),
    org_id: (raw.org_id as string | null) ?? null,
    surfaces: normalizeSurfaces(raw.surfaces),
    creative: normalizeCreative(raw.creative),
    approved_at: (raw.approved_at as string | null) ?? null,
    item_count: Number(raw.item_count ?? 0),
    items_ready_count: Number(raw.items_ready_count ?? 0),
    items: [],
  };
}

function mapDetail(raw: Record<string, unknown> | null): AdminSeasonalPackageDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const pkgRaw = raw.package as Record<string, unknown> | undefined;
  if (!pkgRaw) return null;
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const items: SeasonalPackageAdminItem[] = itemsRaw.map((item, index) => {
    const r = item as Record<string, unknown>;
    return {
      id: String(r.id ?? `tmp-${index}`),
      knowledge_id: String(r.knowledge_id ?? ""),
      tip_output_id: (r.tip_output_id as string | null) ?? null,
      tip_text: String(r.tip_text ?? ""),
      why_now: (r.why_now as string | null) ?? null,
      cta_type: (r.cta_type as SeasonalPackageAdminItem["cta_type"]) ?? "open_knowledge",
      cta_label: String(r.cta_label ?? ""),
      display_order: Number(r.display_order ?? index + 1),
      knowledge_title: (r.knowledge_title as string | null) ?? null,
      knowledge_summary: (r.knowledge_summary as string | null) ?? null,
      knowledge_status: (r.knowledge_status as string | null) ?? null,
      knowledge_applicability:
        (r.knowledge_applicability as Record<string, unknown> | null) ?? null,
    };
  });

  const pkg = mapListRow({
    ...pkgRaw,
    item_count: items.length,
    items_ready_count: items.filter(
      (i) =>
        i.knowledge_status === "published" &&
        i.tip_text.trim().length >= 8 &&
        i.cta_label.trim().length >= 1
    ).length,
  });

  return { package: { ...pkg, items }, items };
}

export function useAdminSeasonalPackages() {
  return useQuery({
    queryKey: ["admin-seasonal-packages"],
    queryFn: async (): Promise<AdminSeasonalPackageListRow[]> => {
      const { data, error } = await (supabase as any).rpc("admin_list_seasonal_packages");
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map((r: Record<string, unknown>) => mapListRow(r));
    },
  });
}

export function useAdminSeasonalPackage(packageId: string | null) {
  return useQuery({
    queryKey: ["admin-seasonal-package", packageId],
    enabled: Boolean(packageId),
    queryFn: async (): Promise<AdminSeasonalPackageDetail | null> => {
      const { data, error } = await (supabase as any).rpc("admin_get_seasonal_package", {
        p_package_id: packageId,
      });
      if (error) throw error;
      return mapDetail(data as Record<string, unknown> | null);
    },
  });
}

export type UpsertSeasonalPackageInput = {
  id?: string;
  slug: string;
  title: string;
  introduction: string;
  season: SeasonalSeason;
  hemisphere?: "northern" | "southern" | "either";
  display_from: string;
  display_until: string;
  urgency_band?: "timely" | "evergreen";
  prep_window_label?: string | null;
  applicability?: Record<string, unknown>;
  surfaces: SeasonalSurfaceId[];
  creative: SeasonalPackageCreative;
  items: Array<{
    id?: string;
    knowledge_id: string;
    tip_output_id?: string | null;
    tip_text: string;
    why_now?: string | null;
    cta_type: string;
    cta_label: string;
    display_order?: number;
  }>;
};

export function useAdminUpsertSeasonalPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertSeasonalPackageInput) => {
      const { data, error } = await (supabase as any).rpc("admin_upsert_seasonal_package", {
        p_package: {
          id: input.id ?? null,
          slug: input.slug,
          title: input.title,
          introduction: input.introduction,
          season: input.season,
          hemisphere: input.hemisphere ?? "northern",
          display_from: input.display_from,
          display_until: input.display_until,
          urgency_band: input.urgency_band ?? "timely",
          prep_window_label: input.prep_window_label ?? null,
          applicability: input.applicability ?? {},
          surfaces: input.surfaces,
          creative: input.creative ?? EMPTY_CREATIVE,
        },
        p_items: input.items,
      });
      if (error) throw error;
      return mapDetail(data as Record<string, unknown>);
    },
    onSuccess: (detail) => {
      void qc.invalidateQueries({ queryKey: ["admin-seasonal-packages"] });
      if (detail?.package.id) {
        void qc.invalidateQueries({ queryKey: ["admin-seasonal-package", detail.package.id] });
      }
    },
  });
}

export function useAdminApproveSeasonalPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packageId: string) => {
      const { data, error } = await (supabase as any).rpc("admin_approve_seasonal_package", {
        p_package_id: packageId,
      });
      if (error) throw error;
      return mapDetail(data as Record<string, unknown>);
    },
    onSuccess: (detail) => {
      void qc.invalidateQueries({ queryKey: ["admin-seasonal-packages"] });
      if (detail?.package.id) {
        void qc.invalidateQueries({ queryKey: ["admin-seasonal-package", detail.package.id] });
      }
      void qc.invalidateQueries({ queryKey: ["seasonal-packages"] });
    },
  });
}

export function useAdminArchiveSeasonalPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packageId: string) => {
      const { data, error } = await (supabase as any).rpc("admin_archive_seasonal_package", {
        p_package_id: packageId,
      });
      if (error) throw error;
      return mapDetail(data as Record<string, unknown>);
    },
    onSuccess: (detail) => {
      void qc.invalidateQueries({ queryKey: ["admin-seasonal-packages"] });
      if (detail?.package.id) {
        void qc.invalidateQueries({ queryKey: ["admin-seasonal-package", detail.package.id] });
      }
      void qc.invalidateQueries({ queryKey: ["seasonal-packages"] });
    },
  });
}

export async function uploadSeasonalPackageImage(input: {
  slug: string;
  kind: "thumbnail" | "square" | "vertical" | "horizontal";
  file: File;
}): Promise<string> {
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "webp";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "webp";
  const path = `packages/${input.slug.replace(/[^a-z0-9-_]/gi, "-").toLowerCase()}/${input.kind}-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage.from("knowledge-content-images").upload(path, input.file, {
    upsert: true,
    contentType: input.file.type || `image/${safeExt}`,
  });
  if (error) throw error;
  return path;
}

export function publicUrlForPackageImage(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("knowledge-content-images").getPublicUrl(path);
  return data.publicUrl || null;
}
