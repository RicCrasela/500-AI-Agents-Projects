import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'src/pages/home_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env.mobile");
  runApp(const ProviderScope(child: LiveTokApp()));
}

class LiveTokApp extends StatelessWidget {
  const LiveTokApp({super.key});

  @override
  Widget build(BuildContext context) {
    final appName = dotenv.env['APP_NAME'] ?? 'LiveTok';
    return MaterialApp(
      title: appName,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xffff2c55), brightness: Brightness.dark),
      ),
      home: const HomePage(),
    );
  }
}