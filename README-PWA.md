# FitFlow — Pack PWA 📱

Ce pack ajoute l’installation de FitFlow comme une application sur téléphone.

## Fichiers à déposer/remplacer à la racine du dépôt GitHub

- `manifest.json`
- `service-worker.js`
- `icons/icon-192.png`
- `icons/icon-512.png`

Ne remplace pas `firebase-config.js`.

## Modification à faire dans `index.html`

Dans le `<head>`, vérifie que tu as déjà cette ligne :

```html
<link rel="manifest" href="manifest.json" />
```

Ajoute aussi cette ligne juste après :

```html
<link rel="apple-touch-icon" href="icons/icon-192.png" />
```

Puis, juste avant la ligne :

```html
<script type="module" src="app.js"></script>
```

ajoute ce bloc :

```html
<script>
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .catch((error) => console.warn("Service worker non enregistré :", error));
    });
  }
</script>
```

## Test après commit

1. Commit changes dans GitHub.
2. Attends 1 à 3 minutes.
3. Ouvre `https://laeti-create.github.io/fitflow/`.
4. Fais Ctrl + F5 sur ordinateur.
5. Sur téléphone :
   - iPhone : Safari > Partager > Ajouter à l’écran d’accueil
   - Android : Chrome > menu ⋮ > Installer l’application ou Ajouter à l’écran d’accueil

## Si l’app ne se met pas à jour

Dans Chrome ordinateur :
DevTools > Application > Service Workers > Unregister.
Puis recharge la page.
