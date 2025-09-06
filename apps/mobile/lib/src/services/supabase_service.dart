import 'dart:async';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final supabaseProvider = Provider<SupabaseService>((ref) => SupabaseService());

class SupabaseService {
  late SupabaseClient client;
  bool _inited = false;

  Future<void> init() async {
    if (_inited) return;
    await Supabase.initialize(
      url: dotenv.env['SUPABASE_URL']!,
      anonKey: dotenv.env['SUPABASE_ANON_KEY']!,
    );
    client = Supabase.instance.client;
    _inited = true;
  }

  Stream<List<Map<String, dynamic>>> liveRoomsStream() async* {
    await init();
    // initial load
    final first = await client.from('rooms').select().eq('live', true).order('viewers', ascending: false);
    yield (first as List).cast<Map<String, dynamic>>();

    // realtime changes
    final controller = StreamController<List<Map<String, dynamic>>>();
    final channel = client
        .channel('rooms_changes_mobile')
        .on(PostgresChangeEvent.insert, ChannelFilter(event: '*', schema: 'public', table: 'rooms'), (payload, [ref]) async {
      final data = await client.from('rooms').select().eq('live', true).order('viewers', ascending: false);
      controller.add((data as List).cast<Map<String, dynamic>>());
    }).subscribe();

    yield* controller.stream;
    await client.removeChannel(channel);
  }
}