"use client";

import { useEffect, useMemo, useState } from "react";
import { LiveKitRoom, GridLayout, ParticipantTile, ControlBar } from "@livekit/components-react";
import "@livekit/components-styles";
import { createClient } from "@supabase/supabase-js";

async function fetchHostToken(roomName: string, identity: string) {
  const res = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&role=host&identity=${encodeURIComponent(identity)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to get token");
  const { token } = await res.json();
  return token as string;
}

async function upsertRoom(id: string, title?: string, thumbnail_url?: string) {
  await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, title, live: true, thumbnail_url }),
  });
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GoLive() {
  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState<string>();
  const [roomName, setRoomName] = useState<string>("");
  const [identity] = useState(() => `host-${Math.random().toString(36).slice(2, 8)}`);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  const uploadCover = async (rn: string) => {
    if (!file) return undefined;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${rn}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("covers").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) {
      console.warn("upload cover error", error.message);
      return undefined;
    }
    const { data: pub } = supabase.storage.from("covers").getPublicUrl(data.path);
    return pub.publicUrl as string;
  };

  const handleStart = async () => {
    const rn = room || title.replace(/\s+/g, "-").toLowerCase().slice(0, 24) || `room-${Date.now()}`;
    setRoomName(rn);
    const coverUrl = await uploadCover(rn);
    await upsertRoom(rn, title, coverUrl);
    const tok = await fetchHostToken(rn, identity);
    setToken(tok);
  };

  const serverUrl = useMemo(() => livekitUrl, [livekitUrl]);

  useEffect(() => {
    return () => {
      if (roomName) {
        fetch("/api/rooms", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: roomName, live: false, viewers: 0 }) });
      }
    };
  }, [roomName]);

  return (
    <main className="min-h-screen">
      {!token ? (
        <div className="max-w-md mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-bold">Mulai Siaran</h1>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul siaran" className="w-full p-3 rounded bg-neutral-900 border border-neutral-800" />
          <input value={room} onChange={e=>setRoom(e.target.value)} placeholder="Room ID (opsional)" className="w-full p-3 rounded bg-neutral-900 border border-neutral-800" />
          <div className="text-sm opacity-80">Cover (opsional):</div>
          <input type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} className="block w-full" />
          <button onClick={handleStart} className="btn w-full">Go Live</button>
          <p className="text-xs opacity-70">Catatan: buat bucket Supabase Storage bernama "covers" (public) untuk menyimpan cover.</p>
        </div>
      ) : (
        <LiveKitRoom
          serverUrl={serverUrl}
          token={token}
          connect
          video
          audio
          data-lk-theme="default"
          style={{ height: "100svh"}}
        >
          <GridLayout className="h-full">
            <ParticipantTile />
          </GridLayout>
          <div className="absolute bottom-0 left-0 right-0">
            <ControlBar className="bg-black/40" />
          </div>
        </LiveKitRoom>
      )}
    </main>
  );
}