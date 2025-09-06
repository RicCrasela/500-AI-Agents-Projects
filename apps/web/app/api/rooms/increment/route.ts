import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { id, delta } = await req.json().catch(() => ({}));
  if (!id || typeof delta !== "number") {
    return NextResponse.json({ error: "id and delta required" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("rpc_increment_viewers", { room_id: id, delta });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ viewers: data });
}