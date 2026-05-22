import { postRoute } from "@/lib/api";
import { runCalibration } from "@/lib/state";

export const POST = postRoute(async () => {
  const result = runCalibration();
  return Response.json(result);
});
