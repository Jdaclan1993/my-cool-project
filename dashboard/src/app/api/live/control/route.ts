import { postRoute } from "@/lib/api";
import { controlLive } from "@/lib/state";

export const POST = postRoute(async (body) => {
  const action = typeof body.action === "string" ? body.action : "";
  const result = controlLive(action);
  return Response.json(result);
});
