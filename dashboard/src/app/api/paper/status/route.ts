import { getRoute } from "@/lib/api";
import { getPaperState } from "@/lib/state";

export const GET = getRoute(async () => {
  return Response.json(getPaperState());
});
