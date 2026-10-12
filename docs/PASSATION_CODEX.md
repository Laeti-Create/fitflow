# Passation FitFlow — Codex sur ordinateur

## Point de reprise

- Dépôt : https://github.com/Laeti-Create/fitflow
- Branche : `feature/glute-10k-hybrid`, PR brouillon #3 vers `develop`.
- Base auditée : `9df56d17a88ca0f256142a72f8ba4d0b768f77bd`.
- Lot 0 publié : `bbeec7e8907006d4926004ba36d89cf0b852b54a`.
- Version de ce lot : `0.54.0-develop.1`.
- Ne PAS pousser sur develop/main : le workflow actuel déploie sur push develop.
- Aucune fusion, migration ni mise en production sans accord explicite de Laeti.

Lire d'abord `secure-coach-plan.md`, `hybrid-integration-plan.md` et
`coach-evaluation.md`. Garder HTML/CSS/modules natifs ; pas de refonte React.

## Ce qui fonctionne et ce qui est seulement préparé

| Élément | État précis |
|---|---|
| Correctifs lot 0 | Conservés, 26 tests de non-régression |
| Isolation locale | localhost et 127.0.0.1 utilisent demo-fitflow et les émulateurs, sans repli production |
| Comptes privés | Règles candidates testées ; règles réellement déployées inconnues, aucune mise à jour distante |
| Invitation/révocation | accessGrants contrôlé par serveur, testé sur émulateur ; interface/serveur de gestion non implémentés |
| Questionnaire | Saisie, validation, priorité, consentement distinct, sauvegarde/rechargement émulateur |
| Musculation | Séries, échauffement, volume externe connu, sauvegarde compatible strengthSessions ; pas encore de bibliothèque d'exercices/templates ni suivi complet de cycle |
| Running | JSON prévisualisé, import atomique sans doublons, calendrier conservé ; pas d'extraction automatique PDF ni synchro Runna/Garmin |
| Nutrition dynamique | Choix pur par type de journée, cible datée enregistrée ; anciens Dashboard/Journal/Trends pas encore raccordés |
| Récupération | Journal nullable, sauvegarde, douleur signalée ; pas de diagnostic/score inventé ni adaptation automatique |
| Coach | Contrôles purs d'identité/consentement/budget et références ; pas d'endpoint, pas de fournisseur, pas de génération |
| Corpus scientifique | Méthode et matrice de recette ; aucun corpus exhaustif validé livré |
| Secrets | .env* ignorés, serveur local refuse leur exposition ; aucune clé OpenAI créée |

Les nouveaux écrans sont dans **Plus → Mon programme hybride** uniquement sur
loopback. Les brouillons sont en mémoire ; les sauvegardes vont aux émulateurs.
Ne pas utiliser de données de santé réelles dans cette préparation locale.
L'environnement hébergé conserve le Firebase d'origine et masque ces parcours.

## Démarrer localement

Installer Git, Node 22 et Java 21 (conseillé ; tests de cette session avec Java 17
et Firebase CLI 14.27.0). Ouvrir le dossier du dépôt dans Codex/VS Code.

```sh
git clone https://github.com/Laeti-Create/fitflow.git
cd fitflow
git switch feature/glute-10k-hybrid
npm ci
npx playwright install chromium
npm test
npm run test:rules
npm run test:integration
```

Pour explorer les écrans : terminal 1 `npm run emulators`, terminal 2
`npm run seed:local` puis `npm run dev`. Ouvrir http://127.0.0.1:4173 et cliquer
« Se connecter avec Alice (test) ». Le compte Bob existe aussi pour les tests.
Ce sont des identités synthétiques locales ; le mot de passe de test n'est pas
un secret de production. Le seed est limité en dur à demo-fitflow/loopback.

Les données d'émulateur sont éphémères. Ne pas importer un export de production.
Utiliser `tests/calendar.fixture.json` comme exemple de format, pas comme
programme sportif. L'import d'un ID déjà existant conserve tout le document.

## Validation de cette session

- `npm test` : 67 tests (métier/politique/non-régression).
- `npm run test:rules` : 14 tests réels sur l'émulateur Firestore.
- `npm run test:integration` : parcours Chromium à 390 × 844, comptes fictifs,
  persistance locale et contrôle d'absence de requêtes Firebase de production.
- Serveur local : refus de .env.local, node_modules, règles et package-lock.
- Les premiers essais Chromium ont échoué au chargement CDN derrière le proxy ;
  le runner utilise le proxy de l'environnement s'il existe. La tolérance au
  certificat du proxy ne concerne QUE ce runner, jamais le code de l'application.
- iPhone/Safari/PWA réels non testés. Aucun appel OpenAI réel ni coût mesuré.
- CI ajoutée pour refaire les tests d'émulateur/navigateur, sans déploiement.

## Travail restant, par ordre

1. Unifier progressivement les callbacks Firebase des anciens modules. Les
   nouveaux adapters capturent UID/génération, mais les anciens consommateurs
   gardent des risques de résultat asynchrone après changement de compte. Tester
   A → déconnexion → B pendant une lecture et une écriture pour CHAQUE module.
   Arrêter les abonnements, vider les stores privés, isoler les clés locales par
   projet et utilisateur. Ne pas annoncer une application entièrement sécurisée
   tant que ce passage n'est pas terminé.
2. Durcir les schémas legacy sans casser les historiques. Les règles candidates
   préservent les 11 collections connues avec validation historique minimale.
   Les nouvelles dates sont validées réellement en JS ; règles regex de forme
   uniquement. Contraintes métier/calendrier serveur à compléter. Les corps de
   requête serveur doivent être validés indépendamment du frontend.
3. Créer un projet Firebase de staging distinct, configurer Auth, invitations,
   comptes d'admin minimaux, App Check, sauvegardes et procédure de restauration.
   Préparer export/suppression des données, durée de conservation et information
   des utilisatrices. Pas de revendication de conformité légale sans revue.
4. Backend IA : tokens vérifiés, quotas atomiques/idempotence, timeouts, journal
   minimal et contrôle des coûts. `server/coach-policy.mjs` ne remplace pas ces
   intégrations. Ne jamais exposer une clé API dans le frontend/PWA.
5. Clé dédiée FitFlow : création autorisée par Laeti, sauvegarde locale .env.local
   également autorisée, MAIS aucune clé créée. Le composant sécurisé manquait
   dans ChatGPT Work. Sur ordinateur suivre la procédure disponible, ou configurer
   directement Secret Manager. Ne jamais demander la clé dans le chat. Les appels
   API sont payés par Laeti ; les amies n'ont pas à payer OpenAI.
6. Corpus/recherche : sources revues, dates, population, force/limites des preuves,
   citations vérifiées ; appliquer la matrice de `coach-evaluation.md`. Valider
   qualité/coût sur profils synthétiques avant données personnelles consenties.
7. Proposition → aperçu → acceptation → programme versionné, sans modification
   silencieuse d'un cycle. Bibliothèque de mouvements et alternatives, séries
   cibles, repos, progression ; garder les séries réelles et anciens résumés.
8. Raccorder calendrier/plannedActivities aux écrans running existants, corriger
   liaison suppression run/statut, et raccorder nutritionTargets aux trois
   consommateurs existants avec suppression du double ajout d'activité.
9. Recette complète historique/nouveaux parcours, mobile réel, offline, update
   PWA, erreurs/réseau, comptes multiples. Demander ensuite l'accord pour tout
   déploiement. Ne pas « tester » en écrivant dans la base Firebase actuelle.

## Message à donner à Codex

> Reprends Laeti-Create/fitflow sur feature/glute-10k-hybrid. Lis
> docs/PASSATION_CODEX.md et docs/secure-coach-plan.md, vérifie le dernier commit
> et la CI, puis poursuis les étapes restantes dans l'ordre. Préserve le design
> et les données existantes, utilise demo-fitflow pour les tests. Présente le
> plan de chaque lot avant modification. Ne fusionne et ne déploie rien sans
> mon accord. Je finance l'API pour mes utilisatrices. La clé n'est pas encore
> créée ; ne me demande jamais de la coller dans le chat.
