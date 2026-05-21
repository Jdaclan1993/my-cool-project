import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    (pathname.startsWith("/api/live/") ||
     pathname.startsWith("/api/paper/") ||
     pathname.startsWith("/api/calibrate/")) &&
    (request.method === "POST" ||
     request.method === "PUT" ||
     request.method === "DELETE")
  ) {
    const authHeader = request.headers.get("X-Dashboard-Auth");

    if (!authHeader || !authHeader.includes(":")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [password, pin] = authHeader.split(":");

    const expectedPassword = process.env.DASHBOARD_PASSWORD;
    const expectedPin = process.env.DASHBOARD_PIN;

    if (password !== expectedPassword || pin !== expectedPin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
