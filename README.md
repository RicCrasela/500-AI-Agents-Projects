# LiveTok — Web & Mobile Livestreaming

A monorepo skeleton to build aplikasi livestreaming mirip TikTok untuk web (Next.js) dan seluler (Flutter), memakai LiveKit (WebRTC low‑latency) dan Supabase untuk auth, daftar live, dan chat realtime.

Struktur yang akan dibuat:
- apps/web — Next.js (App Router) + Tailwind + livekit-react
- apps/mobile — Flutter + livekit_client
- packages/shared — Skema tipe, konstanta, dan protokol chat
- API token — Next.js route untuk mint JWT LiveKit
- Chat — Supabase Realtime channel per room

Langkah cepat:
1) Isi environment pada .env.example (akan saya buat) dengan:
   - LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
   - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
2) Jalankan web: pnpm i && pnpm -C apps/web dev
3) Jalankan mobile: flutter pub get lalu flutter run

Di bawah, tekan “Lanjutkan” jika ingin saya generate seluruh kode proyek di repo ini sekarang.
