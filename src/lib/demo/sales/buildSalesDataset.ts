import { buildHomeOrg } from "@/lib/demo/sales/homeDataset";
import { buildOpsOrg } from "@/lib/demo/sales/opsDataset";
import type { SalesDataset } from "@/lib/demo/sales/types";

export function buildSalesDataset(): SalesDataset {
  const home = buildHomeOrg();
  const ops = buildOpsOrg();
  return {
    timeZone: "Europe/London",
    users: [home.user, ...ops.users],
    files: [...home.files, ...ops.files],
    orgs: [home.org, ops.org],
  };
}
