import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function methodNotAllowed(allowed: string[]) {
  return err("Method not allowed", 405);
}

export async function parseBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

type Handler = (request: Request) => Promise<Response>;

export function postRoute(handler: (body: Record<string, unknown>, request: Request) => Promise<Response>): Handler {
  return async (request) => {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const body = await parseBody(request);
    if (body === null) return err("Invalid JSON", 400);
    return handler(body, request);
  };
}

export function getRoute(handler: () => Promise<Response>): Handler {
  return async (request) => {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return handler();
  };
}
