import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { validateAddress } from "@/services/signals/signalEngineClient";
import { supabase } from "@/integrations/supabase/client";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { Upload } from "lucide-react";

interface PropertyCsvImportProps {
  onImported?: () => void;
}

/**
 * CSV import for properties + spaces (calls import_property_spaces_from_csv RPC).
 */
export function PropertyCsvImport({ onImported }: PropertyCsvImportProps) {
  const { orgId } = useActiveOrg();
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!orgId) {
        toast.error("No organisation selected");
        return;
      }
      setLoading(true);
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          toast.error("CSV must include a header row and at least one data row");
          return;
        }

        // Validate first data row address if present (column heuristic: address or col 2)
        const header = lines[0].toLowerCase();
        const cols = header.split(",");
        const addressIdx = cols.findIndex((c) => c.includes("address"));
        if (addressIdx >= 0 && lines[1]) {
          const firstRow = lines[1].split(",");
          const addr = firstRow[addressIdx]?.trim();
          if (addr) {
            const validation = await validateAddress(orgId, addr);
            if (!validation.valid) {
              toast.warning("Address validation flagged issues — import will continue");
            }
          }
        }

        const { data, error } = await supabase.rpc("import_property_spaces_from_csv", {
          p_org_id: orgId,
          p_csv_data: text,
        });
        if (error) throw error;
        toast.success(`Import complete${data ? `: ${JSON.stringify(data)}` : ""}`);
        onImported?.();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Import failed");
      } finally {
        setLoading(false);
      }
    },
    [orgId, onImported]
  );

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#FF6B6B] font-medium hover:underline">
      <Upload className="h-4 w-4" />
      <span>{loading ? "Importing…" : "Upload property CSV"}</span>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={loading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
