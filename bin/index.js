#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";

function log(msg) {
  console.log(msg);
}

function success(msg) {
  console.log(`${GREEN}✔ ${msg}${RESET}`);
}

function info(msg) {
  console.log(`${CYAN}ℹ ${msg}${RESET}`);
}

function warn(msg) {
  console.log(`${YELLOW}⚠ ${msg}${RESET}`);
}

function error(msg) {
  console.error(`${RED}✖ ${msg}${RESET}`);
}

function printBanner() {
  let version = "1.0.0";
  try {
    const pkg = require('../package.json');
    version = pkg.version || "1.0.0";
  } catch (_) {}

  log(`\n${CYAN}${BOLD}  ███████╗ █████╗ ███╗   ███╗██████╗ ███████╗`);
  log(`  ██╔════╝██╔══██╗████╗ ████║██╔══██╗██╔════╝`);
  log(`  ███████╗███████║██╔████╔██║██████╔╝█████╗  `);
  log(`  ╚════██║██╔══██║██║╚██╔╝██║██╔══██╗██╔══╝  `);
  log(`  ███████║██║  ██║██║ ╚═╝ ██║██║  ██║███████╗`);
  log(`  ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝ - CLI v${version}${RESET}\n`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let command = args[0] || 'help';
  if (command === '--version' || command === '-v') {
    command = 'version';
  } else if (command === '--help' || command === '-h') {
    command = 'help';
  }
  const options = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--version' || arg === '-v') {
      command = 'version';
    } else if (arg.startsWith('--token=')) {
      options.token = arg.split('=')[1];
    } else if (arg === '--token' && args[i + 1]) {
      options.token = args[++i];
    } else if (arg.startsWith('--api-url=')) {
      options.apiUrl = arg.split('=')[1];
    } else if (arg === '--api-url' && args[i + 1]) {
      options.apiUrl = args[++i];
    } else if (arg.startsWith('--api-key=')) {
      options.apiKey = arg.split('=')[1];
    } else if (arg === '--api-key' && args[i + 1]) {
      options.apiKey = args[++i];
    }
  }

  return { command, options };
}

function fetchJson(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Samre-CLI/1.0',
        'ngrok-skip-browser-warning': 'true',
      }
    };

    const req = client.get(urlStr, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Délai d'attente réseau dépassé (10s)."));
    });
  });
}

function generateDartSdkContent(apiKey, baseUrl) {
  return `// ==============================================================================
// 📱 MODULE OFFICIEL SAMRÉ TEST PROTOCOL (Généré automatiquement par samre-cli)
// Ne modifiez pas ce fichier. Il gère la synchronisation et la validation de vos parcours de test.
// ==============================================================================

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class SamreConfig {
  static const String apiKey = '${apiKey}';
  static const String baseUrl = '${baseUrl}';
  static const int requiredUsageSeconds = 0;
}

class SamreSdkService {
  static String? _deviceId;

  static String get deviceId {
    if (_deviceId != null) return _deviceId!;
    final rnd = Random();
    final bytes = List<int>.generate(8, (_) => rnd.nextInt(256));
    _deviceId = 'dev_\${bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';
    return _deviceId!;
  }

  static Future<Map<String, dynamic>> fetchAppInfo() async {
    try {
      final res = await http.get(
        Uri.parse('\${SamreConfig.baseUrl}/api/sdk/app-info'),
        headers: {
          'X-App-Key': SamreConfig.apiKey,
          'ngrok-skip-browser-warning': 'true',
        },
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        return Map<String, dynamic>.from(jsonDecode(res.body));
      }
    } catch (_) {}
    return <String, dynamic>{};
  }

  static Future<bool> isMissionActive() async {
    final data = await fetchAppInfo();
    final statut = data['application']?['statut'] ?? 'active';
    return statut != 'cloturee' && statut != 'archivee' && statut != 'terminee';
  }

  static Future<Map<String, dynamic>> checkStatus({
    required String panelisteUid,
  }) async {
    final cleanUid = panelisteUid.trim().toUpperCase();
    if (cleanUid.isEmpty) return <String, dynamic>{};

    try {
      final res = await http.get(
        Uri.parse('\${SamreConfig.baseUrl}/api/sdk/status?apiKey=\${SamreConfig.apiKey}&panelisteId=\$cleanUid'),
        headers: {
          'X-App-Key': SamreConfig.apiKey,
          'ngrok-skip-browser-warning': 'true',
        },
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        return Map<String, dynamic>.from(jsonDecode(res.body));
      }
    } catch (_) {}
    return <String, dynamic>{};
  }

  static Future<Map<String, dynamic>> verifyCode({
    required String panelisteUid,
    required String code,
  }) async {
    final cleanUid = panelisteUid.trim().toUpperCase();
    final cleanCode = code.trim().toUpperCase();

    try {
      final res = await http.post(
        Uri.parse('\${SamreConfig.baseUrl}/api/sdk/verify-day'),
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': SamreConfig.apiKey,
          'ngrok-skip-browser-warning': 'true',
        },
        body: jsonEncode({
          'apiKey': SamreConfig.apiKey,
          'panelisteId': cleanUid,
          'code': cleanCode,
          'deviceId': deviceId,
        }),
      ).timeout(const Duration(seconds: 15));

      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['success'] == true) {
        return {
          'success': true,
          'message': data['message'] ?? 'Journée validée avec succès !',
          'jour': data['data']?['jourValide'] ?? data['jour'] ?? 1,
          'progression': data['data']?['progression'] ?? data['progression'] ?? 0,
        };
      }
      return {
        'success': false,
        'message': data['message'] ?? (data['error'] ?? 'Code ou identifiant incorrect.'),
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Connexion au serveur Samré impossible.',
      };
    }
  }
}

/// Overlay intelligent discret qui persiste sur TOUS les écrans de l'application
// Observateur de navigation pour détecter quand le testeur change de page
class SamreRouteObserver extends NavigatorObserver {
  static int routeDepth = 0;
  static int pageChanges = 0;
  static String? currentRouteName;
  static final ValueNotifier<int> navigationNotifier = ValueNotifier<int>(0);

  static bool isAuthOrSplashScreen() {
    final name = (currentRouteName ?? '').toLowerCase();
    if (name.isEmpty) return false;
    return name.contains('splash') ||
        name.contains('login') ||
        name.contains('signin') ||
        name.contains('auth') ||
        name.contains('connexion') ||
        name.contains('welcome') ||
        name.contains('intro') ||
        name.contains('onboard');
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    currentRouteName = route.settings.name;
    if (previousRoute != null) {
      routeDepth++;
      pageChanges++;
      navigationNotifier.value++;
    }
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    currentRouteName = previousRoute?.settings.name;
    if (routeDepth > 0) routeDepth--;
    navigationNotifier.value++;
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
    currentRouteName = newRoute?.settings.name;
    pageChanges++;
    navigationNotifier.value++;
  }
}

class SamreOverlay extends StatefulWidget {
  final Widget child;
  const SamreOverlay({super.key, required this.child});

  @override
  State<SamreOverlay> createState() => _SamreOverlayState();
}

class _SamreOverlayState extends State<SamreOverlay> with WidgetsBindingObserver {
  bool _canValidate = true;
  bool _validated = false;
  bool _active = true;
  bool _showModal = false;
  bool _revealed = false;
  int _touchCount = 0;

  // Position déplaçable au doigt
  Offset _btnPosition = const Offset(200, 180);
  bool _positionInitialized = false;

  final TextEditingController _uidController = TextEditingController();
  final TextEditingController _codeController = TextEditingController();
  bool _submitting = false;
  Map<String, dynamic>? _verificationResult;

  String get _todayKey => DateTime.now().toIso8601String().substring(0, 10);
  String get _lockFilePath => '\${Directory.systemTemp.path}/samre_val_\${SamreConfig.apiKey}_\$_todayKey.lock';
  String get _uidFilePath => '\${Directory.systemTemp.path}/samre_uid_\${SamreConfig.apiKey}.txt';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SamreRouteObserver.navigationNotifier.addListener(_onNavigationChange);
    _checkActive();

    // Révélation automatique si l'utilisateur est déjà dans l'app après quelques secondes
    Future.delayed(const Duration(seconds: 8), () {
      if (mounted && !_revealed && SamreRouteObserver.pageChanges >= 1) {
        setState(() {
          _revealed = true;
        });
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkActive();
    }
  }

  @override
  void dispose() {
    SamreRouteObserver.navigationNotifier.removeListener(_onNavigationChange);
    WidgetsBinding.instance.removeObserver(this);
    _uidController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _onNavigationChange() {
    if (mounted) {
      // Révéler dès que le testeur a navigué vers l'application principale (au moins 2 transitions: Splash -> Login -> Home)
      if (SamreRouteObserver.pageChanges >= 2) {
        _revealed = true;
      }
      setState(() {});
    }
  }

  Future<void> _checkActive() async {
    try {
      final uidFile = File(_uidFilePath);
      if (await uidFile.exists()) {
        final savedUid = (await uidFile.readAsString()).trim();
        if (savedUid.isNotEmpty && _uidController.text.isEmpty && mounted) {
          _uidController.text = savedUid;
        }
      }
    } catch (_) {}
  }

  void _initPosition(Size screenSize) {
    if (_positionInitialized || screenSize.width <= 0) return;
    _positionInitialized = true;
    
    // Position discrète par défaut en bas à droite (évite de masquer les en-têtes ou boutons de retour)
    final day = DateTime.now().day;
    final seed = day % 4;
    if (seed == 1) {
      _btnPosition = Offset(screenSize.width - 165, screenSize.height - 140);
    } else if (seed == 2) {
      _btnPosition = Offset(screenSize.width - 165, (screenSize.height / 2) - 25);
    } else if (seed == 3) {
      _btnPosition = Offset(16, screenSize.height - 140);
    } else {
      _btnPosition = Offset(screenSize.width - 165, screenSize.height - 140);
    }
  }

  Future<void> _submitVerification() async {
    final uid = _uidController.text.trim();
    final code = _codeController.text.trim();
    if (uid.isEmpty || code.isEmpty) return;

    setState(() {
      _submitting = true;
      _verificationResult = null;
    });

    final res = await SamreSdkService.verifyCode(
      panelisteUid: uid,
      code: code,
    );

    if (!mounted) return;
    setState(() {
      _submitting = false;
      _verificationResult = res;
    });

    // Auto-fermeture UNIQUEMENT après validation réussie
    if (res['success'] == true) {
      try {
        final uidFile = File(_uidFilePath);
        await uidFile.writeAsString(uid);
      } catch (_) {}

      setState(() {
        _validated = true;
        _canValidate = false;
      });
      Future.delayed(const Duration(milliseconds: 1400), () {
        if (mounted) {
          setState(() {
            _showModal = false;
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    if (!_positionInitialized && screenSize.width > 0) {
      _initPosition(screenSize);
    }

    final isAuthOrSplash = SamreRouteObserver.isAuthOrSplashScreen();
    final bool hasNavigatedToApp = _revealed || SamreRouteObserver.pageChanges >= 2;
    // Ne JAMAIS afficher sur le splash screen ni sur l'écran de connexion / bienvenue
    final bool showButton = !_validated && !_showModal && hasNavigatedToApp && !isAuthOrSplash;

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Overlay(
        initialEntries: [
          OverlayEntry(
            builder: (context) => Stack(
              children: [
                Listener(
                  behavior: HitTestBehavior.translucent,
                  onPointerDown: (_) {
                    _touchCount++;
                    if (!_revealed && (SamreRouteObserver.pageChanges >= 2 || (SamreRouteObserver.pageChanges >= 1 && _touchCount >= 6))) {
                      setState(() {
                        _revealed = true;
                      });
                    }
                  },
                  child: widget.child,
                ),

            // 1. Bouton Flottant Déplaçable au Doigt (Design Pilule Dark Navy & Orange Samré)
            if (showButton)
              Positioned(
                left: _btnPosition.dx.clamp(12.0, (screenSize.width - 175.0).clamp(12.0, double.infinity)),
                top: _btnPosition.dy.clamp(50.0, (screenSize.height - 85.0).clamp(50.0, double.infinity)),
                child: SafeArea(
                  child: GestureDetector(
                    onPanUpdate: (details) {
                      setState(() {
                        _btnPosition = Offset(
                          _btnPosition.dx + details.delta.dx,
                          _btnPosition.dy + details.delta.dy,
                        );
                      });
                    },
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => setState(() => _showModal = true),
                        borderRadius: BorderRadius.circular(28),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(28),
                            border: Border.all(
                              color: const Color(0xFFFF6B00).withOpacity(0.45),
                              width: 1.2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF0F172A).withOpacity(0.40),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                              BoxShadow(
                                color: const Color(0xFFFF6B00).withOpacity(0.20),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 22,
                                height: 22,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFFFF6B00), Color(0xFFEA580C)],
                                  ),
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: const Center(
                                  child: Icon(Icons.touch_app_rounded, color: Colors.white, size: 13),
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'Valider le test',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.2,
                                  decoration: TextDecoration.none,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

          // 2. Modale de Validation Design Moderne, Épuré & Ergonomique
          if (_showModal)
            Positioned.fill(
              child: Material(
                color: const Color(0xFF0F172A).withOpacity(0.60),
                child: SafeArea(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.only(
                        left: 20,
                        right: 20,
                        top: 20,
                        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
                      ),
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.25),
                              blurRadius: 36,
                              offset: const Offset(0, 14),
                            ),
                          ],
                        ),
                        constraints: const BoxConstraints(maxWidth: 365),
                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 22),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // En-tête Moderne avec Logo & Badge
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    borderRadius: BorderRadius.circular(15),
                                    border: Border.all(
                                      color: const Color(0xFFFF6B00).withOpacity(0.3),
                                      width: 1,
                                    ),
                                  ),
                                  child: const Center(
                                    child: Icon(
                                      Icons.verified_user_rounded,
                                      color: Color(0xFFFF6B00),
                                      size: 22,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Validation test',
                                        style: TextStyle(
                                          color: Color(0xFF0F172A),
                                          fontSize: 16,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -0.2,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          Container(
                                            width: 6,
                                            height: 6,
                                            decoration: const BoxDecoration(
                                              color: Color(0xFF10B981),
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          const SizedBox(width: 5),
                                          const Text(
                                            'Test Google Play • Étape du jour',
                                            style: TextStyle(
                                              color: Color(0xFF64748B),
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                InkWell(
                                  onTap: () => setState(() => _showModal = false),
                                  borderRadius: BorderRadius.circular(20),
                                  child: Container(
                                    padding: const EdgeInsets.all(7),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFF1F5F9),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.close_rounded,
                                      size: 16,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 18),

                            // Résultat de validation (Succès ou Erreur)
                            if (_verificationResult != null) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 16),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  color: (_verificationResult!['success'] == true)
                                      ? const Color(0xFFECFDF5)
                                      : const Color(0xFFFEF2F2),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: (_verificationResult!['success'] == true)
                                        ? const Color(0xFFA7F3D0)
                                        : const Color(0xFFFECACA),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      (_verificationResult!['success'] == true)
                                          ? Icons.check_circle_rounded
                                          : Icons.error_outline_rounded,
                                      color: (_verificationResult!['success'] == true)
                                          ? const Color(0xFF059669)
                                          : const Color(0xFFDC2626),
                                      size: 20,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        _verificationResult!['message'] ?? '',
                                        style: TextStyle(
                                          color: (_verificationResult!['success'] == true)
                                              ? const Color(0xFF065F46)
                                              : const Color(0xFF991B1B),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            // Champ 1 : Identifiant Testeur
                            const Text(
                              '1. IDENTIFIANT TESTEUR',
                              style: TextStyle(
                                color: Color(0xFF475569),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _uidController,
                              textCapitalization: TextCapitalization.characters,
                              autocorrect: false,
                              enableSuggestions: false,
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.8,
                              ),
                              decoration: InputDecoration(
                                hintText: 'TST-65CE12',
                                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                prefixIcon: const Icon(Icons.person_rounded, color: Color(0xFF64748B), size: 18),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(15),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(15),
                                  borderSide: const BorderSide(color: Color(0xFFFF6B00), width: 1.6),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),

                            // Champ 2 : Code Unique du Jour
                            const Text(
                              '2. CODE UNIQUE DU JOUR',
                              style: TextStyle(
                                color: Color(0xFF475569),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _codeController,
                              textCapitalization: TextCapitalization.characters,
                              autocorrect: false,
                              enableSuggestions: false,
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 13.5,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.1,
                              ),
                              decoration: InputDecoration(
                                hintText: 'ZOGB-J01-XXXXX',
                                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                prefixIcon: const Icon(Icons.key_rounded, color: Color(0xFF64748B), size: 18),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(15),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(15),
                                  borderSide: const BorderSide(color: Color(0xFFFF6B00), width: 1.6),
                                ),
                              ),
                            ),
                            const SizedBox(height: 22),

                            // Bouton d'Action avec Dégradé Orange Samré
                            Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: _submitting ? null : _submitVerification,
                                borderRadius: BorderRadius.circular(16),
                                child: Ink(
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFFFF6B00), Color(0xFFEA580C)],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFFF6B00).withOpacity(0.38),
                                        blurRadius: 16,
                                        offset: const Offset(0, 6),
                                      ),
                                    ],
                                  ),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    alignment: Alignment.center,
                                    child: _submitting
                                        ? const SizedBox(
                                            height: 20,
                                            width: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                "Valider ma présence aujourd'hui",
                                                style: TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 13.5,
                                                  fontWeight: FontWeight.w800,
                                                  letterSpacing: 0.1,
                                                ),
                                              ),
                                              SizedBox(width: 8),
                                              Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 17),
                                            ],
                                          ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ],
  ),
);
  }
}
`;
}

async function handleInject(options) {
  printBanner();

  const cwd = process.cwd();
  const pubspecPath = path.join(cwd, 'pubspec.yaml');
  const mainDartPath = path.join(cwd, 'lib', 'main.dart');

  // 1. Vérifier qu'on est bien dans un projet Flutter
  if (!fs.existsSync(pubspecPath)) {
    error("Fichier pubspec.yaml introuvable.");
    log(`${YELLOW}Veuillez exécuter cette commande directement à la racine de votre projet Flutter.${RESET}\n`);
    process.exit(1);
  }

  success("Projet Flutter détecté.");

  let apiKey = options.apiKey;
  let baseUrl = options.apiUrl || 'http://localhost:8000';
  let token = options.token;

  // Si l'utilisateur a passé l'URL (ex: ngrok) dans --token au lieu de --api-url
  if (token && (token.startsWith('http://') || token.startsWith('https://'))) {
    if (token.includes('/api/public/integration/')) {
      const parts = token.split('/api/public/integration/');
      baseUrl = parts[0];
      token = parts[1];
    } else {
      baseUrl = token;
      token = null;
      info(`URL API détectée : ${baseUrl}`);
    }
  }

  // 2. Si un token d'intégration est fourni, récupérer les réglages depuis l'API Samré
  if (token) {
    info(`Récupération de la configuration pour le token : ${token}...`);
    try {
      const integrationUrl = `${baseUrl.replace(/\/+$/, '')}/api/public/integration/${token}`;
      const data = await fetchJson(integrationUrl);

      if (data && data.apiKey) {
        apiKey = data.apiKey;
        const appName = data.application?.nom || 'Application';
        success(`Connecté à Samré : Application "${appName}"`);
      } else {
        throw new Error("Clé API introuvable dans la réponse serveur.");
      }
    } catch (e) {
      warn(`Impossible de contacter l'API (${e.message}).`);
      if (!apiKey) {
        error("Aucune clé API disponible. Vérifiez le token ou spécifiez --api-key.");
        process.exit(1);
      }
    }
  }

  if (!apiKey) {
    error("Token d'intégration manquant.");
    log(`${YELLOW}Syntaxe standard :${RESET} node c:\\wamp64\\www\\Samre_Global\\samre-cli\\bin\\index.js inject --token=VOTRE_TOKEN`);
    log(`${YELLOW}Avec ngrok :${RESET} node c:\\wamp64\\www\\Samre_Global\\samre-cli\\bin\\index.js inject --token=VOTRE_TOKEN --api-url=${baseUrl}\n`);
    process.exit(1);
  }

  // 3. Vérifier / ajouter la dépendance http dans pubspec.yaml
  info("Vérification de la dépendance 'http'...");
  let pubspecContent = fs.readFileSync(pubspecPath, 'utf8');
  if (!pubspecContent.includes('http:')) {
    info("Ajout du package http dans pubspec.yaml...");
    if (pubspecContent.includes('dependencies:')) {
      pubspecContent = pubspecContent.replace(/(dependencies:\s*\r?\n)/, '$1  http: ^1.2.0\n');
      fs.writeFileSync(pubspecPath, pubspecContent, 'utf8');
      success("Dépendance http: ^1.2.0 inscrite dans pubspec.yaml.");
    } else {
      pubspecContent += "\ndependencies:\n  http: ^1.2.0\n";
      fs.writeFileSync(pubspecPath, pubspecContent, 'utf8');
      success("Section dependencies et http ajoutées dans pubspec.yaml.");
    }
    try {
      spawnSync('flutter', ['pub', 'get'], { stdio: 'ignore', shell: true });
    } catch (_) {}
  } else {
    success("Dépendance http déjà présente dans pubspec.yaml.");
  }

  // 3bis. Vérifier et créer automatiquement les dossiers d'assets déclarés dans pubspec.yaml (ex: assets/images/)
  try {
    const assetMatches = pubspecContent.match(/^\s*-\s+([a-zA-Z0-9_\-\/]+)\/?\s*$/gm);
    if (assetMatches) {
      for (const rawMatch of assetMatches) {
        const cleanedPath = rawMatch.replace(/^\s*-\s+/, '').trim().replace(/\/+$/, '');
        if (cleanedPath && (cleanedPath.startsWith('assets') || cleanedPath.includes('/'))) {
          const targetDir = path.join(cwd, cleanedPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            info(`Dossier d'assets manquant créé automatiquement : ${cleanedPath}/`);
          }
        }
      }
    }
  } catch (_) {}

  // 4. Générer le fichier lib/samre_sdk.dart
  const sdkPath = path.join(cwd, 'lib', 'samre_sdk.dart');
  info("Création du module lib/samre_sdk.dart...");
  const sdkCode = generateDartSdkContent(apiKey, baseUrl);
  fs.writeFileSync(sdkPath, sdkCode, 'utf8');
  success("Module lib/samre_sdk.dart généré avec succès.");

  // 5. Injecter l'overlay dans lib/main.dart
  if (fs.existsSync(mainDartPath)) {
    info("Branchement du module dans lib/main.dart...");
    let mainContent = fs.readFileSync(mainDartPath, 'utf8');

    // Sauvegarde de sécurité
    const backupPath = path.join(cwd, 'lib', 'main.dart.bak');
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, mainContent, 'utf8');
      info("Sauvegarde de sécurité créée dans lib/main.dart.bak");
    }

    // Ajout de l'import si absent
    if (!mainContent.includes('samre_sdk.dart')) {
      mainContent = `import 'samre_sdk.dart';\n` + mainContent;
    }

    // Injection de l'observateur de navigation pour détecter l'exploration de l'application
    if (!mainContent.includes('SamreRouteObserver()')) {
      if (mainContent.includes('navigatorObservers:')) {
        mainContent = mainContent.replace(
          /navigatorObservers:\s*\[/,
          'navigatorObservers: [SamreRouteObserver(), '
        );
      } else if (mainContent.includes('MaterialApp(')) {
        mainContent = mainContent.replace(
          'MaterialApp(',
          'MaterialApp(\n      navigatorObservers: [SamreRouteObserver()],'
        );
      } else if (mainContent.includes('CupertinoApp(')) {
        mainContent = mainContent.replace(
          'CupertinoApp(',
          'CupertinoApp(\n      navigatorObservers: [SamreRouteObserver()],'
        );
      }
    }

    // Injection de l'overlay dans MaterialApp / CupertinoApp sans créer de doublon de builder
    if (!mainContent.includes('SamreOverlay')) {
      // Nettoie d'abord toute ligne résiduelle ou corrompue de builder SizedBox.shrink
      mainContent = mainContent.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>.*SizedBox\.shrink.*,?\r?\n?/gm, '');
      mainContent = mainContent.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>\s*child\s*\?\?\s*const\s*SizedBox\.shrink\s*\([^)]*(\)|,)?\s*,?\r?\n?/gm, '');
      mainContent = mainContent.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>\s*child\s*\?\?\s*const\s*SizedBox\.shrink\(\),?\r?\n?/gm, '');

      if (mainContent.includes('MaterialApp(')) {
        if (mainContent.includes('builder:')) {
          // Si un builder existe déjà, on remplace le builder existant pour envelopper le child avec SamreOverlay
          mainContent = mainContent.replace(
            /builder:\s*\(([^,]+),\s*([^)]+)\)\s*=>\s*([^,\n;]+)/,
            'builder: ($1, $2) => SamreOverlay(child: $3)'
          );
        } else {
          mainContent = mainContent.replace(
            'MaterialApp(',
            'MaterialApp(\n      builder: (context, child) => SamreOverlay(child: child ?? const SizedBox.shrink()),'
          );
        }
        fs.writeFileSync(mainDartPath, mainContent, 'utf8');
        success("SamreOverlay branché automatiquement dans MaterialApp.");
      } else if (mainContent.includes('CupertinoApp(')) {
        if (mainContent.includes('builder:')) {
          mainContent = mainContent.replace(
            /builder:\s*\(([^,]+),\s*([^)]+)\)\s*=>\s*([^,\n;]+)/,
            'builder: ($1, $2) => SamreOverlay(child: $3)'
          );
        } else {
          mainContent = mainContent.replace(
            'CupertinoApp(',
            'CupertinoApp(\n      builder: (context, child) => SamreOverlay(child: child ?? const SizedBox.shrink()),'
          );
        }
        fs.writeFileSync(mainDartPath, mainContent, 'utf8');
        success("SamreOverlay branché automatiquement dans CupertinoApp.");
      } else {
        warn("Point d'injection MaterialApp/CupertinoApp non trouvé automatiquement.");
        log(`Ajoutez simplement ceci dans votre MaterialApp :`);
        log(`${CYAN}builder: (context, child) => SamreOverlay(child: child!),${RESET}`);
      }
    } else {
      fs.writeFileSync(mainDartPath, mainContent, 'utf8');
      success("SamreOverlay branché avec SamreRouteObserver dans main.dart.");
    }
  }

  log(`\n${GREEN}${BOLD}🎉 SUCCÈS ! LE MODULE SAMRÉ EST INJECTÉ DANS VOTRE APPLICATION.${RESET}`);
  log(`${CYAN}----------------------------------------------------------------`);
  log(`1. Le formulaire et le bouton de validation sont activés dans votre application.`);
  log(`2. Les testeurs peuvent valider leur code du jour directement.`);
  log(`3. Vous pouvez tester en local ou compiler pour le Play Store :`);
  log(`   ${BOLD}flutter build appbundle${RESET}`);
  log(`4. Pour retirer le module une fois la campagne terminée :`);
  log(`   ${BOLD}npx samre-cli remove${RESET}`);
  log(`${CYAN}----------------------------------------------------------------\n${RESET}`);
}

function handleRemove() {
  printBanner();
  const cwd = process.cwd();
  const sdkPath = path.join(cwd, 'lib', 'samre_sdk.dart');
  const mainDartPath = path.join(cwd, 'lib', 'main.dart');
  const backupPath = path.join(cwd, 'lib', 'main.dart.bak');

  info("Nettoyage du module Samré...");

  if (fs.existsSync(sdkPath)) {
    fs.unlinkSync(sdkPath);
    success("Fichier lib/samre_sdk.dart supprimé.");
  }

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, mainDartPath);
    fs.unlinkSync(backupPath);
    success("Fichier lib/main.dart restauré depuis sa sauvegarde d'origine.");
  }

  // Assainissement systématique de lib/main.dart pour éliminer toute trace ou ligne résiduelle
  if (fs.existsSync(mainDartPath)) {
    let content = fs.readFileSync(mainDartPath, 'utf8');
    // Supprime l'import du SDK Samré
    content = content.replace(/^[ \t]*import ['"]samre_sdk\.dart['"];\r?\n?/gm, '');

    // Nettoie proprement tout builder SamreOverlay ou SizedBox.shrink injecté
    content = content.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>\s*SamreOverlay\s*\(\s*child:\s*child\s*\?\?\s*const\s*SizedBox\.shrink\(\)\s*\),?\r?\n?/gm, '');
    content = content.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>\s*SamreOverlay\([\s\S]*?SizedBox\.shrink\(\)\s*\),?\r?\n?/gm, '');
    content = content.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>\s*SamreOverlay\s*\(\s*child:\s*child!?\s*\),?\r?\n?/gm, '');

    // Nettoie TOUTE ligne résiduelle, tronquée ou corrompue contenant SizedBox.shrink
    content = content.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>.*SizedBox\.shrink.*,?\r?\n?/gm, '');
    content = content.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>\s*child\s*\?\?\s*const\s*SizedBox\.shrink\s*\([^)]*(\)|,)?\s*,?\r?\n?/gm, '');
    content = content.replace(/^[ \t]*builder:\s*\(context,\s*child\)\s*=>\s*child\s*\?\?\s*const\s*SizedBox\.shrink\(\),?\r?\n?/gm, '');

    // Si SamreOverlay enveloppait un autre widget utilisateur personnalisé
    if (content.includes('SamreOverlay(')) {
      content = content.replace(/SamreOverlay\(\s*child:\s*([a-zA-Z0-9_$.!]+)\s*\)/g, '$1');
    }

    fs.writeFileSync(mainDartPath, content, 'utf8');
    success("Références Samré nettoyées dans lib/main.dart.");
  }

  const pubspecPath = path.join(cwd, 'pubspec.yaml');
  if (fs.existsSync(pubspecPath)) {
    let pubContent = fs.readFileSync(pubspecPath, 'utf8');
    if (pubContent.includes('http: ^1.2.0')) {
      pubContent = pubContent.replace(/^[ \t]*http:\s*\^1\.2\.0\r?\n/m, '');
      fs.writeFileSync(pubspecPath, pubContent, 'utf8');
      info("Dépendance http nettoyée de pubspec.yaml.");
    }
  }

  log(`\n${GREEN}${BOLD}✔ Votre projet Flutter est propre et remis dans son état initial.${RESET}\n`);
}

function handleHelp() {
  printBanner();
  log(`Usage :`);
  log(`  ${BOLD}npx samre-cli inject --token=<VOTRE_TOKEN_INTEGRATION>${RESET}`);
  log(`  ${BOLD}npx samre-cli remove${RESET} (pour désinstaller après le test)\n`);
}

function handleVersion() {
  const pkg = require('../package.json');
  log(`samre-cli v${pkg.version}`);
}

// Router
const { command, options } = parseArgs();

switch (command) {
  case 'version':
  case '-v':
  case '--version':
    handleVersion();
    break;
  case 'inject':
  case 'install':
  case 'init':
    handleInject(options);
    break;
  case 'remove':
  case 'uninstall':
  case 'clean':
    handleRemove();
    break;
  case 'help':
  default:
    handleHelp();
    break;
}
