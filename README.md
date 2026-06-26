# FitFlow — Starter app v1 ☀️

Cette version est un premier MVP statique compatible GitHub Pages + Firebase.

## Ce que contient la v1

- Écran de connexion
- Dashboard
- Ajout d’une séance de marche
- Résumé de séance
- Historique marche
- Graphiques simples sans librairie externe
- Ajout d’un poids
- Historique poids
- Paramètres
- Mode démo si Firebase n’est pas encore configuré
- Synchronisation Firebase Auth + Firestore dès que la configuration est renseignée

## Installation rapide sur GitHub Pages

1. Dézipper ce dossier.
2. Mettre tous les fichiers à la racine du dépôt `fitflow`.
3. Dans GitHub > dépôt `fitflow` > Settings > Pages :
   - Source : Deploy from a branch
   - Branch : main
   - Folder : /root
4. Attendre le déploiement.
5. Ouvrir : `https://laeti-create.github.io/fitflow/`

## Configuration Firebase

### 1. Créer / utiliser ton projet Firebase

Dans Firebase Console :

- Ajouter une application Web
- Copier la configuration Firebase
- Coller les valeurs dans `firebase-config.js`

### 2. Activer Google Auth

Firebase Console > Authentication > Sign-in method > Google > Enable.

Ajoute aussi les domaines autorisés :

- `laeti-create.github.io`
- `localhost`

### 3. Créer Firestore

Firebase Console > Firestore Database > Create database.

Puis remplace les règles par le contenu du fichier `firestore.rules`.

## Structure des données Firestore

```txt
users/{uid}
users/{uid}/profile/main
users/{uid}/walks/{walkId}
users/{uid}/weights/{weightId}
```

## Note importante

La formule calories est une estimation simple pour démarrer. Elle pourra être améliorée ensuite avec tes paramètres réels : poids, vitesse, pente, durée, bras appuyés, fréquence cardiaque si tu veux l’ajouter plus tard.
