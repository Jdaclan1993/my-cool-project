import { getRoute } from "@/lib/api";
import { getLiveState } from "@/lib/state";

export const GET = getRoute(async () => {
  return Response.json(getLiveState());
});
