# Level Up IA — Dashboard

Plateforme de gestion d'agence (espace admin + espace client) — Next.js 15, Tailwind CSS 4,
GraphQL (Yoga), PostgreSQL, Prisma.

Documents de référence : `data/LevelUpIA_Dashboard_2026-08-23_cahier-des-charges.pdf` et
[docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## Installation

```bash
# 1. Dépendances
npm install

# 2. Base de données (PostgreSQL requis)
createdb levelup                      # ou CREATE DATABASE levelup;
cp .env.example .env                  # puis renseigner DATABASE_URL et AUTH_SECRET
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql

# 3. Client Prisma + données de démonstration
npm run db:generate
npm run db:seed

# 4. Lancer
npm run dev        # développement — http://localhost:3000
npm run build && npm start   # production
```

## Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Admin | `sarra@levelupia.tn` | `Admin2026!` |
| Client (Résidence Carthage) | `amine@carthage.tn` | `Client2026!` |
| Client (Boutique Nour) | `nour@boutiquenour.tn` | `Client2026!` |

Les comptes de connexion sont stockés en base de données et se gèrent dans l'application :
**Équipe → Comptes de connexion** (créer un compte admin ou client, réinitialiser un mot de
passe, désactiver). Chaque utilisateur change son propre mot de passe via le bouton
« Mot de passe » (barre latérale, menu mobile, ou Mon profil). Pour amorcer un tout premier
compte sur une base vide : `npx tsx prisma/create-user.ts <email> <nom> <mot de passe>`.

## Architecture

- `database/schema.sql` — **source de vérité** du schéma (SERIAL/BIGSERIAL, enums français,
  numérotation séquentielle des factures, vues de reporting). Toute évolution passe par ce fichier.
- `prisma/schema.prisma` — miroir typé du schéma SQL (jamais de `prisma migrate`).
- `src/server/services/` — logique métier ; **chaque fonction applique le cloisonnement par rôle
  dans la requête SQL** (un client ne voit que son `client_id`).
- `src/graphql/` + `/api/graphql` — API GraphQL (profondeur limitée, introspection coupée en
  production, erreurs masquées).
- `/api/files/[uuid]` — téléchargement des livrables : lien non devinable (UUID), session et
  propriété vérifiées côté serveur, fichiers stockés hors du dossier public (`storage/uploads/`).
- `src/middleware.ts` — garde des routes `/admin` et `/client` par rôle (défense en profondeur).

## Sécurité

- Sessions JWT en cookie `httpOnly` + `SameSite=Lax`, mots de passe bcrypt (coût 12),
  verrouillage après 5 échecs de connexion, journal d'audit (`audit_logs`).
- Cloisonnement démontrable : connecté client A, ouvrir un projet du client B renvoie
  `FORBIDDEN` côté API et 404 côté fichiers — y compris en modifiant l'URL.
