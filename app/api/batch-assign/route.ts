import { NextResponse } from "next/server";
import { z } from "zod";
import { batchAssign } from "@/lib/batchAssign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  delivery_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  zone: z.string().trim().max(40).optional(),
  time_window: z.enum(["morning", "afternoon", "evening"]).optional(),
  dry_run: z.boolean().optional(),
});

/** POST /api/batch-assign -> assign every pending delivery that matches the filter. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await batchAssign(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch assign failed";
    const status = message.startsWith("Unknown zone") ? 400 : 500;
    if (status === 500) console.error("[batch-assign]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
