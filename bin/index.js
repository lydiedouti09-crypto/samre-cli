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
  log(`\n${BLUE}${BOLD}================================================================${RESET}`);
  log(`${CYAN}${BOLD}       🚀 SAMRÉ FLUTTER SDK — INJECTEUR AUTOMATIQUE             ${RESET}`);
  log(`${BLUE}${BOLD}================================================================${RESET}\n`);
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
// Ne modifiez pas ce fichier. Il gère la preuve de présence Google Play et s'autodétruit
// automatiquement une fois la mission de test terminée (J+12).
// ==============================================================================

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class SamreConfig {
  static const String apiKey = '${apiKey}';
  static const String baseUrl = '${baseUrl}';
  static const int requiredUsageSeconds = 25; // 25s d'activité réelle dans l'app
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

  static Future<bool> isMissionActive() async {
    try {
      final res = await http.get(
        Uri.parse('\${SamreConfig.baseUrl}/api/sdk/app-info'),
        headers: {
          'X-App-Key': SamreConfig.apiKey,
          'ngrok-skip-browser-warning': 'true',
        },
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final statut = data['application']?['statut'] ?? 'active';
        return statut != 'cloturee' && statut != 'archivee' && statut != 'terminee';
      }
    } catch (_) {}
    return true;
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
  static final ValueNotifier<int> navigationNotifier = ValueNotifier<int>(0);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    if (previousRoute != null) {
      routeDepth++;
      pageChanges++;
      navigationNotifier.value++;
    }
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    if (routeDepth > 0) routeDepth--;
    navigationNotifier.value++;
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
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
  Timer? _timer;
  int _seconds = 0;
  int _interactions = 0;
  bool _canValidate = false;
  bool _validated = false;
  bool _active = true;
  bool _showModal = false;

  // Position déplaçable au doigt
  Offset? _btnPosition;
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
    _checkIfAlreadyValidatedToday();
    _checkActive();
    _startTimer();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkIfAlreadyValidatedToday();
    }
  }

  @override
  void dispose() {
    SamreRouteObserver.navigationNotifier.removeListener(_onNavigationChange);
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _uidController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _checkIfAlreadyValidatedToday() async {
    try {
      final file = File(_lockFilePath);
      if (await file.exists()) {
        if (mounted) {
          setState(() {
            _validated = true;
            _canValidate = false;
          });
        }
        _timer?.cancel();
        return;
      }
    } catch (_) {}

    // Pré-remplir l'identifiant s'il avait déjà été saisi lors d'une session précédente
    try {
      final uidFile = File(_uidFilePath);
      if (await uidFile.exists()) {
        final savedUid = (await uidFile.readAsString()).trim();
        if (savedUid.isNotEmpty && _uidController.text.isEmpty) {
          _uidController.text = savedUid;
        }
      }
    } catch (_) {}
  }

  void _onNavigationChange() {
    if (mounted) {
      setState(() {});
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!_active || _validated) {
        t.cancel();
        return;
      }
      if (mounted) {
        setState(() {
          _seconds++;
          if (_seconds >= 6) {
            _canValidate = true;
          }
        });
      }
    });
  }

  Future<void> _checkActive() async {
    final active = await SamreSdkService.isMissionActive();
    if (mounted) {
      setState(() {
        _active = active;
        if (!_active) _timer?.cancel();
      });
    }
  }

  void _initPosition(Size screenSize) {
    if (_positionInitialized) return;
    _positionInitialized = true;
    
    // Position dynamique calculée selon le jour / session pour changer de page et d'endroit
    final daySeed = DateTime.now().day % 4;
    switch (daySeed) {
      case 0: // En bas à droite
        _btnPosition = Offset(screenSize.width - 180, screenSize.height - 110);
        break;
      case 1: // En haut à droite (sous l'app bar)
        _btnPosition = Offset(screenSize.width - 180, 90);
        break;
      case 2: // Au milieu à droite
        _btnPosition = Offset(screenSize.width - 180, screenSize.height / 2 - 25);
        break;
      case 3: // En bas à gauche
      default:
        _btnPosition = Offset(20, screenSize.height - 110);
        break;
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

    // Auto-fermeture après validation réussie ou si déjà validé
    if (res['success'] == true || (res['message'] != null && res['message'].toString().contains('déjà été validé'))) {
      // Sauvegarder la validation du jour pour que le formulaire ne réapparaisse plus du tout aujourd'hui
      try {
        final file = File(_lockFilePath);
        await file.writeAsString('validated_\${DateTime.now().toIso8601String()}');
        final uidFile = File(_uidFilePath);
        await uidFile.writeAsString(uid);
      } catch (_) {}

      setState(() {
        _validated = true;
        _timer?.cancel();
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
    // Si la mission est terminée ou déjà validée, le module s'efface totalement
    if (!_active || _validated) return widget.child;

    final screenSize = MediaQuery.of(context).size;
    if (!_positionInitialized && screenSize.width > 0) {
      _initPosition(screenSize);
    }

    // Le bouton NE DOIT JAMAIS s'afficher sur la page de démarrage (page 1 / splash / accueil initial)
    // Il n'apparaît que quand le testeur a navigué sur une autre page (routeDepth > 0 ou pageChanges > 0 ou interactions suffisantes)
    final bool isStartPage = (SamreRouteObserver.routeDepth == 0 && SamreRouteObserver.pageChanges == 0 && _interactions < 8);
    final bool showButton = _canValidate && !isStartPage && !_showModal && _btnPosition != null;

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Listener(
        onPointerDown: (_) {
          _interactions++;
          if (_interactions >= 8 && !_canValidate && _seconds >= 5) {
            setState(() => _canValidate = true);
          }
        },
        child: Stack(
          children: [
            widget.child,

            // 1. Bouton Flottant Déplaçable au Doigt (UNIQUEMENT sur les autres pages)
            if (showButton)
              Positioned(
                left: _btnPosition!.dx.clamp(10.0, screenSize.width - 170.0),
                top: _btnPosition!.dy.clamp(40.0, screenSize.height - 80.0),
                child: SafeArea(
                  child: GestureDetector(
                    onPanUpdate: (details) {
                      setState(() {
                        _btnPosition = Offset(
                          _btnPosition!.dx + details.delta.dx,
                          _btnPosition!.dy + details.delta.dy,
                        );
                      });
                    },
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => setState(() => _showModal = true),
                        borderRadius: BorderRadius.circular(30),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                            ),
                            borderRadius: BorderRadius.circular(30),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF2563EB).withOpacity(0.45),
                                blurRadius: 14,
                                offset: const Offset(0, 5),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.touch_app_rounded, color: Colors.white, size: 17),
                              SizedBox(width: 6),
                              Text(
                                'Valider le test',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
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

          // 2. Modale de Validation Design Premium (Fond clair / Blanc épuré moderne)
          if (_showModal)
            Positioned.fill(
              child: Material(
                color: Colors.black.withOpacity(0.55),
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
                              color: Colors.black.withOpacity(0.22),
                              blurRadius: 30,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        constraints: const BoxConstraints(maxWidth: 380),
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // En-tête avec Icône et Fermeture
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFFEFF6FF), Color(0xFFDBEAFE)],
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: const Icon(
                                    Icons.verified_user_rounded,
                                    color: Color(0xFF2563EB),
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Validation de test',
                                        style: TextStyle(
                                          color: Color(0xFF0F172A),
                                          fontSize: 17,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      SizedBox(height: 2),
                                      Text(
                                        'Test de présence quotidienne',
                                        style: TextStyle(
                                          color: Color(0xFF64748B),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                InkWell(
                                  onTap: () => setState(() => _showModal = false),
                                  borderRadius: BorderRadius.circular(20),
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Icon(
                                      Icons.close,
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
                                  color: (_verificationResult!['success'] == true ||
                                          _verificationResult!['message'].toString().contains('déjà'))
                                      ? const Color(0xFFECFDF5)
                                      : const Color(0xFFFEF2F2),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: (_verificationResult!['success'] == true ||
                                            _verificationResult!['message'].toString().contains('déjà'))
                                        ? const Color(0xFFA7F3D0)
                                        : const Color(0xFFFECACA),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      (_verificationResult!['success'] == true ||
                                              _verificationResult!['message'].toString().contains('déjà'))
                                          ? Icons.check_circle_rounded
                                          : Icons.error_outline_rounded,
                                      color: (_verificationResult!['success'] == true ||
                                              _verificationResult!['message'].toString().contains('déjà'))
                                          ? const Color(0xFF059669)
                                          : const Color(0xFFDC2626),
                                      size: 20,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        _verificationResult!['message'],
                                        style: TextStyle(
                                          color: (_verificationResult!['success'] == true ||
                                                  _verificationResult!['message'].toString().contains('déjà'))
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

                            // Champ 1 : Identifiant Panéliste
                            const Text(
                              'IDENTIFIANT TESTEUR',
                              style: TextStyle(
                                color: Color(0xFF475569),
                                fontSize: 10,
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
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                              ),
                              decoration: InputDecoration(
                                hintText: 'Ex: TST-5D735C',
                                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                prefixIcon: const Icon(Icons.badge_outlined, color: Color(0xFF64748B), size: 18),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),

                            // Champ 2 : Code Unique du Jour
                            const Text(
                              'CODE DU JOUR',
                              style: TextStyle(
                                color: Color(0xFF475569),
                                fontSize: 10,
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
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.5,
                              ),
                              decoration: InputDecoration(
                                hintText: 'Ex: ZOGB-J01-066B4E',
                                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                prefixIcon: const Icon(Icons.key_rounded, color: Color(0xFF64748B), size: 18),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),

                            // Bouton d'Action
                            ElevatedButton(
                              onPressed: _submitting ? null : _submitVerification,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF2563EB),
                                foregroundColor: Colors.white,
                                elevation: 2,
                                shadowColor: const Color(0xFF2563EB).withOpacity(0.35),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              child: _submitting
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text(
                                      'Valider ma présence aujourd\\'hui',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
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
  const baseUrl = options.apiUrl || 'http://localhost:8000';
  const token = options.token;

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
    error("Token manquant. Syntaxe : npx samre-cli inject --token=VOTRE_TOKEN");
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
      success("SamreOverlay déjà branché dans main.dart.");
    }
  }

  log(`\n${GREEN}${BOLD}🎉 SUCCÈS ! LE MODULE SAMRÉ EST INJECTÉ DANS VOTRE APPLICATION.${RESET}`);
  log(`${CYAN}----------------------------------------------------------------`);
  log(`1. Le formulaire apparaîtra automatiquement après 25s d'utilisation.`);
  log(`2. Vous pouvez tester en local ou compiler pour le Play Store :`);
  log(`   ${BOLD}flutter build appbundle${RESET}`);
  log(`3. Pour retirer le module une fois les 12 jours finis :`);
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
