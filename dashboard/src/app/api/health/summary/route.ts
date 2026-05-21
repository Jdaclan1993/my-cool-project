import { getRoute } from "@/lib/api";
import { getHealth } from "@/lib/state";

export const GET = getRoute(async () => {
  return Response.json(getHealth());
});
