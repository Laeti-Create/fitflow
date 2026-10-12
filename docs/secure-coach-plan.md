# FitFlow — plan révisé du 12 octobre 2026

Branche de travail : feature/glute-10k-hybrid. Aucune fusion ni publication
en production autorisée. Le lot 0 reste conservé. Ce document remplace la
priorité donnée à un programme personnel codé en dur.

## Architecture et livraison

Conserver HTML, CSS, modules natifs et Firebase. Ajouter des fonctions métier
pures partagées et testables, puis des adaptateurs de persistance. Les fonctions
ne dépendent ni du DOM ni de Firebase. Les interfaces conservent les cartes et
la palette existantes. Les nouveaux parcours restent locaux jusqu'à validation
des règles et du serveur. Aucun historique existant n'est migré ou écrasé.

1. Isoler localhost dans demo-fitflow ; connecter Auth et Firestore aux émulateurs
   avant toute lecture. Fournir un serveur local qui refuse les secrets/fichiers
   internes. Aucun repli vers la production si un émulateur est indisponible.
2. Tester des règles candidates : utilisateur vérifié et invité, propriétaire
   seulement, révocation immédiate par document serveur, rôles et quotas non
   modifiables par le client. Les règles de production restent inchangées.
3. Construire le questionnaire et la validation : disponibilités, objectifs
   classés, expérience, matériel, historique récent, préférences, sommeil,
   nutrition et contraintes. Aucune donnée de cette conversation n'est injectée
   dans le profil des utilisatrices. Données sensibles facultatives ; consentement
   spécifique avant transmission à OpenAI ; aucun partage des profils entre amies.
4. Musculation : séries réelles, échauffement séparé, unités explicites, pas de
   volume inventé pour poids du corps/assistance ; progression proposée seulement.
   Running : calendrier importable JSON avec aperçu, dates locales, identifiants
   stables, aucun remplacement silencieux d'un résultat terminé.
5. Nutrition : cibles choisies par l'utilisatrice selon le type de journée ;
   politique explicite pour les jours mixtes ; jamais ajouter une seconde fois
   les calories d'exercice. Journal manquant = inconnu. Récupération : journal
   facultatif, sans score médical inventé ni changement automatique du programme.
6. Coach serveur : Firebase ID token vérifié + App Check, identité dérivée du
   token, invitation contrôlée à chaque appel, clé en gestionnaire de secrets.
   Réserver le budget atomiquement avant l'appel ; quotas utilisateur et global,
   identifiant idempotent, refus en cas d'indisponibilité du compteur, taille et
   temps maximum des requêtes, rapprochement coût réel/réservé, journaux sans
   questionnaires ni tokens d'authentification. Pas d'endpoint OpenAI public direct.
7. Tester les parcours sur navigateur puis iPhone réel ; valider la recette dans
   un projet Firebase distinct avant de solliciter une autorisation de déploiement.

## Exigence scientifique

L'objectif est la qualité des preuves et leur applicabilité, pas le nombre de
citations. Une instruction « utilise les dernières études » ne suffit pas.
Maintenir un registre éditorial : titre, DOI/URL, population, type d'étude, date de
publication, date de vérification, limites, domaines couverts et statut de revue.
Privilégier recommandations institutionnelles, consensus et revues systématiques ;
études isolées contextualisées ; prépublications explicitement signalées.

La recherche récupère uniquement des sources autorisées. Le texte récupéré est
une donnée non fiable et ne peut donner d'instructions au serveur. Ne pas envoyer
nom, email ou récit médical personnel dans une requête de recherche publique.
Les citations finales doivent référencer des sources réellement récupérées et
les affirmations qu'elles soutiennent ; une URL valide n'est pas une preuve de
pertinence. Une revue éditoriale et des évaluations humaines restent nécessaires.

Chaque proposition contient une synthèse du questionnaire, les données manquantes,
les arbitrages entre course/musculation/récupération, la progression, les
alternatives, les limites et les références. Afficher « vérifié le … » et non
« toutes les dernières études ». Ne pas diagnostiquer, prescrire de traitement,
ou inventer une autorisation médicale. Les situations non couvertes demandent un
avis professionnel et ne déclenchent pas une prescription automatique.

Références de méthode consultées le 12/10/2026 :
- https://www.who.int/publications/i/item/9789240015128 (recommandations de santé
  publique, ne remplace pas un protocole individuel d'hypertrophie).
- https://firebase.google.com/docs/rules/unit-tests (tests des règles isolés).
- https://developers.openai.com/api/docs/guides/structured-outputs (schéma de
  sortie, à compléter par validation métier et évaluation de la justesse).

## Comptes, données et mise en service

La bêta est sur invitation. Le compte d'administration gère les invitations et
budgets ; ce rôle ne lui ouvre pas les journaux privés. L'accès Firestore doit
être réellement imposé par les règles, pas seulement caché dans l'interface.
Une révocation arrête l'accès distant ; elle ne peut effacer magiquement une
copie déjà exportée. Prévoir export/suppression par l'utilisatrice, durée de
conservation documentée, suppression des sous-collections côté serveur et revue
de confidentialité avant ouverture aux amies. Éviter les brouillons sensibles
persistants par défaut sur un appareil partagé.

La clé a été autorisée mais n'a PAS été créée : le composant de sauvegarde sécurisé
est absent de cette session. La connexion sera réalisée depuis Codex sur ordinateur
ou directement dans le gestionnaire de secrets du serveur. Les tests sans API ne
prouvent ni la qualité médicale, ni le coût réel, ni le bon fonctionnement distant.
