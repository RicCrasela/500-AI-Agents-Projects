# LiveTok Deploy Guide

Panduan ringkas untuk mempublikasikan aplikasi LiveTok (Web + Mobile).

## 1) Prasyarat

- Akun LiveKit Cloud
- Akun Supabase
- Akun Vercel (untuk hosting Next.js)
- Flutter SDK untuk build Android/iOS

## 2) Siapkan Supabase

1. Buat project di Supabase.
2. Catat:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
3. Buka SQL Editor dan jalankan file berikut di repo:
   - apps/web/supabase/schema.sql
     - Membuat tabel rooms, chat_messages
     - Membuat RPC rpc_increment_viewers dan (jika Anda menambah) rpc_increment_likes
4. Aktifkan Realtime untuk schema public (default aktif).

Auth (Magic Link):
- Settings → Auth → Providers → Email: Enable
- Settings → Auth → URL Configuration:
  - Tambahkan http://localhost:3000/auth/callback (dev)
  - Tambahkan https://<domain-vercel-anda>/auth/callback (prod)

## 3) Siapkan LiveKit Cloud

1. Buat project di LiveKit Cloud, buat API Key & Secret.
2. Catat:
   - LIVEKIT_URL (wss://<subdomain>.livekit.cloud)
   - LIVEKIT_API_KEY
   - LIVEKIT_API_SECRET

## 4) Deploy Web ke Vercel

1. Hubungkan repo GitHub ke Vercel, pilih root repo (apps/web berada di subfolder).
2. Project Settings:
   - Framework: Next.js
   - Build: otomatis
   - Root directory: biarkan default (Vercel mendeteksi Next.js di apps/web).
     - Jika tidak terdeteksi, set Build & Output Settings:
       - Root Directory: apps/web
3. Environment Variables (Production/Preview/Development):
   - LIVEKIT_URL
   - LIVEKIT_API_KEY
   - LIVEKIT_API_SECRET
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - NEXT_PUBLIC_APP_NAME=LiveTok
4. Deploy. Setelah sukses, catat domain vercel (contoh: https://livetok-yourname.vercel.app).

Verifikasi:
- Buka / → feed rooms.
- Buka /go-live → mulai siaran (butuh login jika auth diaktifkan).
- Buka /live/<roomId> → menonton, chat realtime tampil.

## 5) Menjalankan Lokal (opsi)

Root .env.local:
```
LIVEKIT_URL=wss://<subdomain>.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_NAME=LiveTok
```

Jalankan:
```
pnpm i
pnpm dev
```

## 6) Mobile Android

1. Konfigurasi:
   - cd apps/mobile
   - flutter create .
   - flutter pub get
2. Buat file .env.mobile (salin dari .env.mobile.example):
```
API_BASE_URL=https://<domain-vercel-anda>
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
LIVEKIT_URL=wss://<subdomain>.livekit.cloud
APP_NAME=LiveTok
```
3. Android Permissions (AndroidManifest.xml):
```
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```
4. Jalankan:
```
flutter run -d android
```
5. Build APK/AAB:
```
flutter build apk
flutter build appbundle
```
6. Play Store:
- Buat keystore & signingConfig, upload AAB via Play Console.
- Siapkan ikon, screenshot (1080x1920), deskripsi.

## 7) Mobile iOS

1. Konfigurasi:
   - cd apps/mobile
   - flutter create .
   - flutter pub get
2. Buka Xcode:
   - open ios/Runner.xcworkspace
   - Set Team & Bundle ID
3. Info.plist:
```
<key>NSCameraUsageDescription</key>
<string>Digunakan untuk siaran live.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Digunakan untuk siaran live audio.</string>
```
4. Jalankan:
```
flutter run -d ios
```
5. TestFlight/App Store:
- Archive di Xcode → Upload ke App Store Connect → TestFlight.

## 8) Variabel Lingkungan Ringkas

Web (Vercel):
- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_APP_NAME

Mobile (.env.mobile):
- API_BASE_URL=https://<domain-vercel>
- SUPABASE_URL
- SUPABASE_ANON_KEY
- LIVEKIT_URL
- APP_NAME

## 9) Troubleshooting

- Video tidak tampil:
  - Pastikan LIVEKIT_URL adalah wss (TLS) dan kredensial benar.
- Chat tidak muncul:
  - Pastikan schema.sql telah dijalankan dan Realtime aktif.
  - Cek NEXT_PUBLIC_SUPABASE_URL/ANON_KEY benar di web & mobile.
- Mobile tidak bisa akses API lokal:
  - Gunakan domain Vercel atau tunneling (ngrok/Cloudflare Tunnel).
  - Android Emulator gunakan http://10.0.2.2:3000.

## 10) CI (opsional)

GitHub Actions (web) telah disiapkan jika diperlukan. Vercel biasanya sudah mengurus build otomatis saat push.

Selamat publikasi!