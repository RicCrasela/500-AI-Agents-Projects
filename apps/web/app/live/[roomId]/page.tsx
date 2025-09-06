"use client";

import { useEffect, useMemo, useState } from "react";
import { RoomAudioRenderer, ControlBar, LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function fetchViewerToken(roomName: string) {
  const res = await fetch(`/api/token?room=${encodeURIComponent(roomName)}&role=viewer`);
  if (!res.ok) throw new Error("Failed to get token");
  const { token } = await res.json();
  return token as string;
}

export default function LiveRoomPage({ params }: { params: { roomId: string } }) {
  const roomName = params.roomId;
  const [token, setToken] = useState<string>();
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  useEffect(() => {
    fetchViewerToken(roomName).then(setToken).catch(console.error);
  }, [roomName]);

  // simple presence/viewers update
  useEffect(() => {
    const channel = supabase.channel(`room:${roomName}`).subscribe();
    return () => { supabase.removeChannel(channel); };
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
          <div className="absolute inset-0 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0">
            <ControlBar className="bg-black/40" />
          </div>
        </LiveKitRoom>
      )}
    </main>
  );
}