import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:livekit_client/livekit_client.dart';
import '../widgets/chat_widget.dart';

class LivePage extends StatefulWidget {
  final String roomId;
  const LivePage({super.key, required this.roomId});

  @override
  State<LivePage> createState() => _LivePageState();
}

class _LivePageState extends State<LivePage> {
  Room? _room;
  late final String _identity;

  @override
  void initState() {
    super.initState();
    _identity = 'viewer-${DateTime.now().millisecondsSinceEpoch}';
    _connect();
  }

  Future<void> _connect() async {
    final base = dotenv.env['API_BASE_URL']!;
    final tokenRes = await LiveKitTokenFetcher.getToken(
      '$base/api/token?room=${Uri.encodeComponent(widget.roomId)}&role=viewer',
    );
    final url = dotenv.env['LIVEKIT_URL']!;
    final room = Room(roomOptions: const RoomOptions());
    await room.connect(url, tokenRes);
    setState(() => _room = room);
  }

  @override
  void dispose() {
    _room?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final room = _room;
    return Scaffold(
      appBar: AppBar(title: Text(widget.roomId)),
      body: room == null
          ? const Center(child: CircularProgressIndicator())
          : Stack(
              children: [
                RoomWidget(room: room),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: ChatWidget(roomId: widget.roomId, identity: _identity),
                )
              ],
            ),
    );
  }
}

// helper to fetch token via http
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

class RoomWidget extends StatelessWidget {
  final Room room;
  const RoomWidget({super.key, required this.room});

  @override
  Widget build(BuildContext context) {
    return VideoView(
      room: room,
      fit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
    );
  }
}