import { NextResponse } from "next/server";
import { z } from "zod";
import { clarify } from "@/lib/ai";
import { getSession } from "@/lib/session";

const Body = z.object({
  text: z.string().min(1).max(8000),
  location: z.string().max(60).optional(),
  time_of_day: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.anon_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  return NextResponse.json(await clarify(parsed.data));
}
