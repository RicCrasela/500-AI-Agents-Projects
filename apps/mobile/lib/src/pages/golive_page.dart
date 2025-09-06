import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';

class GoLivePage extends StatefulWidget {
  const GoLivePage({super.key});

  @override
  State<GoLivePage> createState() => _GoLivePageState();
}

class _GoLivePageState extends State<GoLivePage> {
  final _titleCtrl = TextEditingController();
  final _roomCtrl = TextEditingController();
  Room? _room;

  Future<void> _start() async {
    await Permission.camera.request();
    await Permission.microphone.request();

    final title = _titleCtrl.text.trim();
    final roomId = _roomCtrl.text.trim().isEmpty
        ? (title.isNotEmpty ? title.replaceAll(RegExp(r'\s+'), '-').toLowerCase() : 'room-${DateTime.now().millisecondsSinceEpoch}')
        : _roomCtrl.text.trim();

    final base = dotenv.env['API_BASE_URL']!;
    final token = await LiveKitTokenFetcher.getToken(
      '$base/api/token?room=${Uri.encodeComponent(roomId)}&role=host&identity=${Uri.encodeComponent("host-mobile")}',
    );
    final url = dotenv.env['LIVEKIT_URL']!;
    final room = Room(roomOptions: const RoomOptions(defaultCameraCaptureOptions: CameraCaptureOptionsParams(facingMode: CameraFacing.front)));
    await room.connect(url, token);
    await room.localParticipant?.setCameraEnabled(true);
    await room.localParticipant?.setMicrophoneEnabled(true);
    setState(() => _room = room);
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _roomCtrl.dispose();
    _room?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = _room;
    return Scaffold(
      appBar: AppBar(title: const Text('Go Live')),
      body: r == null
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  TextField(controller: _titleCtrl, decoration: const InputDecoration(labelText: 'Judul')) ,
                  TextField(controller: _roomCtrl, decoration: const InputDecoration(labelText: 'Room ID (opsional)')),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: _start, child: const Text('Mulai Siaran'))
                ],
              ),
            )
          : Stack(
              children: [
                VideoView(room: r, fit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        FilledButton(
                          onPressed: () async {
                            await r.disconnect();
                            setState(() => _room = null);
                          },
                          style: FilledButton.styleFrom(backgroundColor: Colors.red),
                          child: const Text('Stop'),
                        )
                      ],
                    ),
                  ),
                )
              ],
            ),
    );
  }
}

class LiveKitTokenFetcher {
  static Future<String> getToken(String url) async {
    final res = await LiveKitClient.httpClient.get(Uri.parse(url));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      final body = res.body;
      final token = RegExp(r'"token"\s*:\s*"([^"]+)"').firstMatch(body)?.group(1);
      if (token != null) return token;
    }
    throw Exception('Cannot fetch token');
  }
}