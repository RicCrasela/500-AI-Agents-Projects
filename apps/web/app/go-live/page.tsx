"use client";

import { useEffect, useMemo, useState } from "react";
import { LiveKitRoom, GridLayout, ParticipantTile, ControlBar } from "@livekit/components-react";
import "@livekit/components-styles";

async function fetchHostToken(roomName: string, identity: string) {
  const res = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&role=host&identity=${encodeURIComponent(identity)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to get token");
  const { token } = await res.json();
  return token as string;
}

async function upsertRoom(id: string, title?: string) {
  await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, title, live: true }),
  });
}

export default function GoLive() {
  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [token, setToken] = useState<string>();
  const [roomName, setRoomName] = useState<string>("");
  const [identity] = useState(() => `host-${Math.random().toString(36).slice(2, 8)}`);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  const handleStart = async () => {
    const rn = room || title.replace(/\s+/g, "-").toLowerCase().slice(0, 24) || `room-${Date.now()}`;
    setRoomName(rn);
    await upsertRoom(rn, title);
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
          <button onClick={handleStart} className="btn w-full">Go Live</button>
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