import { NextResponse } from "next/server";
import {
  dashboardSessionCookie,
  isDashboardConfigured,
  verifyDashboardPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!isDashboardConfigured()) {
    return NextResponse.json(
      { ok: false, error: "DASHBOARD_PASSWORD is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as { password?: unknown };
  if (typeof body.password !== "string" || !verifyDashboardPassword(body.password)) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  const cookie = dashboardSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
