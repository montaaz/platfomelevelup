# Déploiement sur le serveur (Ubuntu)

## 1. Node.js 20+ obligatoire

Tailwind v4 (`@tailwindcss/oxide`) exige **Node ≥ 20**. Avec Node 18, `npm install`
affiche `EBADENGINE` puis **n'installe pas le binaire natif**, et `next dev` échoue avec :

```
Error: Cannot find native binding.
```

Vérifier la version installée :

```bash
node -v      # doit afficher v20.x ou plus
```

### Installer Node 20 LTS (au choix)

**Option A — NodeSource (recommandé sur un serveur) :**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v
```

**Option B — nvm (si plusieurs projets cohabitent) :**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20        # lit aussi le fichier .nvmrc du projet
nvm use
```

## 2. Réinstaller les dépendances proprement

Le `node_modules` créé sous Node 18 est incomplet : il faut le supprimer.

```bash
cd ~/app/platfomelevelup
rm -rf node_modules package-lock.json
npm install
npx prisma generate
```

## 3. Variables d'environnement

Créer `.env` à la racine (jamais versionné) :

```bash
DATABASE_URL="postgresql://levelup:<mot-de-passe-encodé>@localhost:5433/levelup?schema=public"
AUTH_SECRET="<32 caractères aléatoires minimum>"
APP_URL="https://votre-domaine.tn"
```

> **Encodage du mot de passe :** les caractères spéciaux doivent être encodés une fois.
> `@` → `%40`, `%` → `%25`. Un mot de passe contenant littéralement `%40` s'écrit donc `%2540`.
> Générer un secret : `openssl rand -base64 32`

## 4. Lancer en production

`npm run dev` n'est pas fait pour la production (lent, non optimisé) :

```bash
npm run build
npm run start          # écoute sur le port 3000
```

Garder le service en vie avec PM2 :

```bash
sudo npm install -g pm2
pm2 start npm --name levelup -- run start
pm2 save
pm2 startup            # exécuter la commande affichée
pm2 logs levelup
```

## 5. Vérifications

```bash
node -v                                   # >= 20
curl -I http://localhost:3000/login       # HTTP 200
```
