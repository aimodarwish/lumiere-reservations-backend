import { NextResponse } from "next/server";
import { z } from "zod";
import { hasDashboardSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "seated", "completed", "cancelled", "no_show"]),
});

export async function PATCH(request: Request) {
  if (!(await hasDashboardSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("reservations")
    .update({ reservation_status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
