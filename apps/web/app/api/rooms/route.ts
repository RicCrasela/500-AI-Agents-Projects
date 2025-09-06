import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, title, live } = body as { id: string; title?: string; live?: boolean };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const { data, error } = await supabase
    .from("rooms")
    .upsert({ id, title: title || id, live: live ?? true }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, viewers, live } = body as { id: string; viewers?: number; live?: boolean };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const updates: any = {};
  if (typeof viewers === "number") updates.viewers = viewers;
  if (typeof live === "boolean") updates.live = live;
  const { data, error } = await supabase.from("rooms").update(updates).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data });
}