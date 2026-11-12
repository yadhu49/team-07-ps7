import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health -> shows which settings are missing (never shows the values). */
export async function GET() {
  // GEMINI_MODEL is optional (it has a default), so it is not checked here.
  const names = ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_PASSCODE"];
  const settings = Object.fromEntries(names.map((n) => [n, Boolean(process.env[n]?.trim())]));
  const allSet = Object.values(settings).every(Boolean);

  let deliveriesTable = false;
  let databaseError: string | null = null;
  if (settings.SUPABASE_URL && settings.SUPABASE_SECRET_KEY) {
    const { error } = await getSupabase().from("deliveries").select("id", { head: true, count: "exact" });
    if (error) databaseError = error.message;
    else deliveriesTable = true;
  }

  return NextResponse.json({
    ok: allSet && deliveriesTable,
    settings,
    deliveriesTable,
    databaseError,
  });
}
