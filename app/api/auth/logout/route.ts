import { NextResponse } from "next/server";
import { dashboardCookieName } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(dashboardCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
