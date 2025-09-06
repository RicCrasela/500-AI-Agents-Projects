"use client";

import { useEffect, useMemo, useState } from "react";
import { RoomAudioRenderer, ControlBar, LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import Chat from "@/components/Chat";
import { supabase } from "@/lib/supabase";

async function fetchViewerToken(roomName: string) {
  const res = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&role=viewer`);
  if (!res.ok) throw new Error("Failed to get token");
  const { token } = await res.json();
  return token as string;
}

async function incrementViewers(id: string, delta: number) {
  await fetch("/api/rooms/increment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, delta }),
  });
}

export default function LiveRoomPage({ params }: { params: { roomId: string } }) {
  const roomName = params.roomId;
  const [token, setToken] = useState<string>();
  const [identity] = useState(() => `viewer-${Math.random().toString(36).slice(2, 8)}`);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  useEffect(() => {
    fetchViewerToken(roomName).then(setToken).catch(console.error);
  }, [roomName]);

  // presence/viewers update atomically using RPC
  useEffect(() => {
    let active = true;
    incrementViewers(roomName, +1).catch(() => {});
    const channel = supabase.channel(`room:${roomName}`).subscribe();
    const handleUnload = () => {
      if (active) incrementViewers(roomName, -1);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      active = false;
      incrementViewers(roomName, -1).catch(() => {});
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [roomName]);

  const serverUrl = useMemo(() => livekitUrl, [livekitUrl]);

  return (
    <main className="min-h-screen">
      {!token ? (
        <div className="p-10 text-center">Memuat...</div>
      ) : (
        <LiveKitRoom
          serverUrl={serverUrl}
          token={token}
          connect={true}
          video={true}
          audio={true}
          className="h-[100svh]"
        >
          <RoomAudioRenderer />
          <Chat roomId={roomName} identity={identity} />
          <div className="absolute bottom-0 left-0 right-0">
            <ControlBar className="bg-black/40" />
          </div>
        </LiveKitRoom>
      )}
    </main>
  );
}