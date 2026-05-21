import { postRoute } from "@/lib/api";
import { controlPaper, simulateTrade } from "@/lib/state";

export const POST = postRoute(async (body) => {
  const action = typeof body.action === "string" ? body.action : "";
  if (action === "simulateTrade") {
    const result = simulateTrade();
    return Response.json({ success: true, ...result });
  }
  const result = controlPaper(action);
  return Response.json(result);
});
