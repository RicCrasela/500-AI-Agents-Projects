import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';
import 'live_page.dart';
import 'golive_page.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  @override
  void initState() {
    super.initState();
    ref.read(supabaseProvider).init();
  }

  @override
  Widget build(BuildContext context) {
    final supa = ref.watch(supabaseProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('LiveTok'),
        actions: [
          IconButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GoLivePage())),
            icon: const Icon(Icons.add_circle_outline),
          )
        ],
      ),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: supa.liveRoomsStream(),
        builder: (context, snapshot) {
          final data = snapshot.data ?? [];
          if (data.isEmpty) {
            return const Center(child: Text('Belum ada siaran'));
          }
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 9/16
            ),
            itemCount: data.length,
            itemBuilder: (context, i) {
              final r = data[i];
              return InkWell(
                onTap: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => LivePage(roomId: r['id'] as String)));
                },
                child: Container(
                  decoration: BoxDecoration(color: Colors.grey.shade900, borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.all(8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Expanded(child: Center(child: Icon(Icons.live_tv, size: 64))),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.pink, borderRadius: BorderRadius.circular(6)),
                        child: const Text('LIVE', style: TextStyle(fontSize: 12)),
                      ),
                      const SizedBox(height: 6),
                      Text(r['title'] ?? r['id'], maxLines: 2, overflow: TextOverflow.ellipsis),
                      Text('${r['viewers'] ?? 0} penonton', style: const TextStyle(fontSize: 12, color: Colors.white70)),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}