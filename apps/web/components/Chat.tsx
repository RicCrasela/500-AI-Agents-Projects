"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: number;
  room_id: string;
  sender: string;
  message: string;
  created_at: string;
};

export default function Chat({ roomId, identity }: { roomId: string; identity: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data as any) || []);
    };
    load();

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setText("");
    await supabase.from("chat_messages").insert({
      room_id: roomId,
      sender: identity,
      message: msg,
    });
  };

  return (
    <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
      <div className="max-h-64 overflow-y-auto space-y-1">
        {messages.slice(-50).map((m) => (
          <div key={m.id} className="text-sm"><span className="font-semibold">{m.sender}:</span> {m.message}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ketik pesan..."
          className="flex-1 rounded-full bg-black/40 border border-white/10 px-4 py-2"
          onKeyDown={(e)=>{ if(e.key==="Enter") send(); }}
        />
        <button onClick={send} className="btn">Kirim</button>
      </div>
    </div>
  );
}