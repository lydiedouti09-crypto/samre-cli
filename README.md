# Samré CLI — Injecteur automatique pour Flutter 🚀

Outil en ligne de commande pour injecter le protocole de test Samré (Google Play Closed Testing) dans n'importe quelle application Flutter en **une seule commande**.

## Utilisation

Le développeur se place à la racine de son projet Flutter et exécute :

```bash
npx samre-cli inject --token=VOTRE_TOKEN_INTEGRATION
```

### Ce que fait cette commande automatiquement :
1. ✅ Détecte le projet Flutter (`pubspec.yaml`).
2. ✅ Contacte l'API Samré pour récupérer la configuration et la clé d'intégration de l'application.
3. ✅ Ajoute la dépendance réseau `http: ^1.2.0`.
4. ✅ Génère le module autonome `lib/samre_sdk.dart`.
5. ✅ Branche l'overlay anti-triche dans `lib/main.dart` (avec sauvegarde automatique dans `main.dart.bak`).

---

## Retirer le module après les 12 jours de test

Une fois la campagne de test terminée, le développeur peut nettoyer son projet avec :

```bash
npx samre-cli remove
```

Cela restaure le `main.dart` d'origine et supprime les fichiers temporaires.
