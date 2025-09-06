# LiveTok Mobile (Flutter)

Client Flutter untuk LiveTok. Siap build Android (APK/AAB) dan iOS (IPA/TestFlight).

Konfigurasi env:
- Salin `.env.mobile.example` ke `.env.mobile` dan isi:
  - `API_BASE_URL` — URL server Next.js token endpoint
    - Android Emulator: `http://10.0.2.2:3000`
    - iOS Simulator: `http://localhost:3000`
    - Perangkat fisik: `http://IP-Laptop:3000`
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  - `LIVEKIT_URL` — wss LiveKit Cloud, mis. `wss://<subdomain>.livekit.cloud`

Setup sekali:
1) cd apps/mobile
2) Generate folder platform lokal (agar repo tetap ringan):
   - `flutter create .`
3) `flutter pub get`

Android (APK/AAB):
1) Pastikan izin di `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   ```
2) Build & run:
   - Debug: `flutter run -d android`
   - APK: `flutter build apk`
   - AAB (Play Store): `flutter build appbundle`

iOS (IPA/TestFlight):
1) Buka `ios/Runner.xcworkspace` di Xcode (set Team & Bundle ID).
2) Tambahkan pada `ios/Runner/Info.plist`:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>Digunakan untuk siaran live.</string>
   <key>NSMicrophoneUsageDescription</key>
   <string>Digunakan untuk siaran live audio.</string>
   ```
3) Jalankan:
   - Simulator: `flutter run -d ios`
   - Distribusi: Archive via Xcode atau `flutter build ipa` (butuh signing).

Fitur saat ini:
- Home feed rooms (Supabase)
- Player viewer (LiveKit) + chat realtime
- Go Live host dari kamera ponsel

Catatan koneksi:
- Server Next.js (apps/web) harus dapat diakses device (gunakan IP yang sesuai).
- LiveKit harus wss publik (LiveKit Cloud/self-host dengan TLS).