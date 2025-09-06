# LiveTok Mobile (Flutter)

Client Flutter untuk LiveTok.

Konfigurasi:
- Salin .env.mobile.example ke .env.mobile dan isi:
  - API_BASE_URL (alamat Next.js, mis. http://10.0.2.2:3000 untuk Android emulator)
  - SUPABASE_URL, SUPABASE_ANON_KEY
  - LIVEKIT_URL (wss)

Jalankan:
- flutter pub get
- flutter run

Fitur:
- Home feed rooms (Supabase)
- Player viewer (LiveKit) + chat realtime
- Go Live host dari kamera ponsel