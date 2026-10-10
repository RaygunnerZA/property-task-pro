import { TASK_STATUS_ORDER, TASK_STATUS_VISUALS } from "@/lib/taskStatus";
import type { FilterFavourite } from "@/lib/filterFavourites";

/** Status icons that sit in the favourites row. Cancelled stays under FILTER › Status. */
export const TASK_STATUS_FAVOURITES: FilterFavourite[] = TASK_STATUS_ORDER.filter(
  (status) => status !== "archived"
).map((status) => ({
  kind: "option",
  id: TASK_STATUS_VISUALS[status].filterId,
}));
