# Evalis — plateforme d'interrogations & suivi en temps réel

Front-end React + Vite, back-end = fonctions serverless Vercel (`api/`) + base Supabase (Postgres).

- **Étudiants** : `https://votre-site.vercel.app/` (nom + code PIN)
- **Enseignant** : `https://votre-site.vercel.app/#/enseignant` (+ mot de passe)

## Déploiement (≈ 10 min)

1. **Supabase** (supabase.com, plan gratuit) : créer un projet, puis *SQL Editor* → coller et exécuter `supabase/schema.sql`.
   Récupérer *Project Settings → API* : `Project URL` et la clé **`service_role`** (secrète).
2. **Vercel** : importer le projet, puis *Settings → Environment Variables* :

   | Variable | Valeur |
   |---|---|
   | `SUPABASE_URL` | URL du projet Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` |
   | `TEACHER_PASSWORD` | mot de passe enseignant |
   | `AUTH_SECRET` | chaîne aléatoire ≥ 32 car. (`openssl rand -hex 32`) |
   | `GEMINI_API_KEY` | *(optionnel)* génération de questions par IA |
   | `VITE_TEACHER_ROUTE` | *(optionnel)* segment secret du lien prof, ex. `prof-x7k2q9` |

3. Redéployer. Ces variables (sauf `VITE_*`) restent côté serveur, jamais dans le navigateur.

## Développement local

```bash
npm install
cp .env.example .env.local   # facultatif : sans Supabase, les données sont gardées en mémoire
npm run dev                  # UN SEUL terminal : front (port 3000) + API /api intégrée (mot de passe prof par défaut : prof1234)
npm run test:api             # tests de l'API
```

## Anti-triche (pendant l'épreuve étudiant)

Dès que l'étudiant change de fenêtre/onglet/application, réduit le navigateur, appuie sur PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5 ou lance une impression :
- les questions sont **masquées immédiatement** et l'épreuve est **bloquée 5 minutes** (réglable de 1 à 60 min, ou désactivable, dans « Concevoir une épreuve ») ;
- le blocage est enregistré **côté serveur** : recharger la page ne le contourne pas ;
- le chronomètre de l'épreuve continue de tourner pendant le blocage ;
- l'incident (heure + type) apparaît chez le professeur (« ⚠ n sortie(s) de fenêtre » dans le tableau et dans la copie).
Le copier/couper et le clic droit sont aussi désactivés pendant l'épreuve.

**Limites (inhérentes au web)** : un navigateur ne peut pas détecter une photo de l'écran avec un second téléphone, ni toutes les captures faites par un logiciel externe ou un système qui ne déclenche ni changement de focus ni touche détectable. C'est un moyen de dissuasion et de traçabilité, pas une garantie absolue. Pour un examen à fort enjeu, combinez avec une surveillance en salle.

## Sécurité — ce que fait le serveur

- La correction se fait **côté serveur** ; les bonnes réponses ne sont jamais envoyées au navigateur de l'étudiant avant la remise, et seulement après clôture de l'épreuve (ou si `showCorrection` est activé).
- Session enseignant : mot de passe vérifié par le serveur, jeton signé (HMAC) valable 12 h.
- Session étudiant : jeton secret par copie (reprise possible après rechargement).
- Durée de l'épreuve contrôlée par le serveur (tolérance de 2 min à la remise).
- Les tables Supabase ont RLS activé sans policy : seule la clé `service_role` des fonctions y accède.

Limite connue : l'étudiant s'identifie par son nom (+ PIN). Deux personnes saisissant le même nom sur la même épreuve partagent la même copie.

## Importer l'interrogation « Numération » (30 variantes)

Le fichier `seed/interroNumeration.json` contient les bonnes réponses : il n'est **importé par aucun code du site**, donc il n'est jamais publié sur Internet.
Dans l'espace enseignant, onglet des interrogations, cliquez sur **« Importer un fichier d'interrogation »** et choisissez ce fichier depuis votre ordinateur : 3 interrogations (groupes 1 à 3, PIN `#SM1-G1`, `#SM1-G2`, `#SM1-G3`) sont créées avec leurs 30 variantes.
Gardez le dépôt GitHub en **privé**.
