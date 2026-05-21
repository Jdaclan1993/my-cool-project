import { getRoute } from "@/lib/api";
import { getStats } from "@/lib/state";

export const GET = getRoute(async () => {
  return Response.json(getStats());
});
