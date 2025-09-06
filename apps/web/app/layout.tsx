import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "LiveTok",
  description: "Livestreaming mirip TikTok — WebRTC by LiveKit",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}