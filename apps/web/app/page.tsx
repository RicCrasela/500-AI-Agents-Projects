"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

type LiveRoom = {
  id: string;
  title: string;
  live: boolean;
  viewers: number;
  thumbnail_url?: string | null;
};

export default function Home() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("rooms").select("*").eq("live", true).order("viewers", { ascending: false });
      setRooms((data as any) || []);
    };
    load();

    const channel = supabase
      .channel("rooms_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, (payload) => {
        const row = payload.new as LiveRoom;
        setRooms((prev) => {
          const others = prev.filter((r) => r.id !== row.id);
          return row.live ? [row, ...others] : others;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main className="min-h-screen">
      <header className="p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{process.env.NEXT_PUBLIC_APP_NAME || "LiveTok"}</h1>
        <Link href="/go-live" className="btn">Go Live</Link>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {rooms.map((r) => (
          <Link key={r.id} href={`/live/${r.id}`} className="relative rounded-xl overflow-hidden bg-neutral-900">
            <div className="aspect-[9/16] relative">
              {r.thumbnail_url ? (
                <Image src={r.thumbnail_url} alt={r.title} fill style={{objectFit:"cover"}} />
              ) : (
                <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">No Cover</div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                <span className="text-xs bg-pink-600 px-2 py-0.5 rounded">LIVE</span>
                <h3 className="text-sm mt-1 line-clamp-2">{r.title}</h3>
                <p className="text-xs opacity-70">{r.viewers} penonton</p>
              </div>
            </div>
          </Link>
        ))}
        {!rooms.length && (
          <div className="col-span-full text-center opacity-70 py-20">Belum ada siaran. Jadilah yang pertama!</div>
        )}
      </section>

      <nav className="fixed bottom-[calc(var(--safe)+12px)] left-0 right-0 mx-auto max-w-md bg-neutral-900/80 backdrop-blur rounded-full p-2 flex gap-2 justify-around">
        <Link className="px-4 py-2" href="/">Beranda</Link>
        <Link className="px-4 py-2" href="/go-live">+</Link>
        <a className="px-4 py-2" href="#">Profil</a>
      </nav>
    </main>
  );
}