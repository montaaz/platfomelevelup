# Déploiement — levelupia.app

Serveur : `31.70.137.202` · Projet : `/root/app/platfomelevelup` · Port interne : **3000**

Architecture visée (plusieurs applications sur la même machine) :

```
Navigateur → Cloudflare (HTTPS) → Nginx :80/:443 → PM2 → Next.js :3000
                                        ↘ autre-app :3001, :3002 …
```

Nginx est indispensable ici : un seul service peut écouter sur le port 443, il
distribue ensuite vers chaque application selon le nom de domaine.

---

## 0. Débloquer `git pull`

Les fichiers modifiés localement sur le serveur (`next.config.ts`, `package.json`)
sont déjà corrigés dans le dépôt. On écrase la version locale :

```bash
cd /root/app/platfomelevelup
git checkout -- next.config.ts package.json
git pull
```

> Si d'autres fichiers bloquent : `git stash` (les met de côté) puis `git pull`.

---

## 1. Nettoyer PM2

Trois processus `levelup` existent (deux arrêtés). On repart proprement :

```bash
pm2 delete all
pm2 save --force
```

---

## 2. Variables d'environnement

`/root/app/platfomelevelup/.env` (jamais versionné) :

```bash
DATABASE_URL="postgresql://levelup:CSScss110595%2540123do@localhost:5433/levelup?schema=public"
AUTH_SECRET="<32+ caractères aléatoires>"
APP_URL="https://levelupia.app"
NODE_ENV="production"
```

Générer le secret : `openssl rand -base64 32`

> **Encodage :** un caractère spécial du mot de passe s'encode une fois — `@` → `%40`,
> `%` → `%25`. Le mot de passe contenant littéralement `%40` s'écrit donc `%2540`.

---

## 3. Build de production

`npm run dev` n'est pas fait pour la production (lent, non optimisé, expose le débogage).

```bash
cd /root/app/platfomelevelup
npm install
npx prisma generate
npm run build
```

---

## 4. Lancer avec PM2

```bash
cd /root/app/platfomelevelup
pm2 start npm --name levelup -- run start
pm2 save
pm2 startup        # exécuter la ligne affichée pour le démarrage automatique
pm2 logs levelup   # vérifier
```

Vérification locale :

```bash
curl -I http://localhost:3000/login    # doit répondre HTTP/1.1 200
```

---

## 5. Nginx — domaine + plusieurs applications

```bash
apt update && apt install -y nginx
```

Créer `/etc/nginx/sites-available/levelupia.app` :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name levelupia.app www.levelupia.app;

    # taille des livrables uploadés (doit couvrir la limite applicative de 100 Mo)
    client_max_body_size 110M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # en-têtes indispensables : sans eux les redirections repartent vers localhost
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        # websocket / HMR
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 300s;
    }
}
```

Activer et recharger :

```bash
ln -s /etc/nginx/sites-available/levelupia.app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### Ajouter une autre application plus tard

Chaque application écoute un port différent et reçoit son propre fichier :

```bash
# app 2 sur le port 3001
pm2 start npm --name autre-app -- run start   # avec PORT=3001 dans son .env
cp /etc/nginx/sites-available/levelupia.app /etc/nginx/sites-available/autre-domaine.tn
# éditer : server_name autre-domaine.tn;  proxy_pass http://127.0.0.1:3001;
ln -s /etc/nginx/sites-available/autre-domaine.tn /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 6. Cloudflare

### DNS

Dans **DNS → Records**, un enregistrement A :

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `levelupia.app` | `31.70.137.202` | Proxied (nuage orange) |
| A | `www` | `31.70.137.202` | Proxied |

### SSL/TLS — le point critique

Dans **SSL/TLS → Overview**, choisir **Full (strict)** si un certificat est installé
sur le serveur, sinon **Full**.

> ⚠️ **Ne jamais laisser « Flexible ».** Cloudflare parlerait alors au serveur en HTTP :
> le cookie de session (`secure`) serait rejeté par le navigateur et **personne ne
> pourrait se connecter**, avec une boucle de redirection vers `/login`.

### Certificat HTTPS avec Certbot (Let's Encrypt)

Certbot valide le domaine en HTTP. Le proxy Cloudflare intercepte cette
validation : il faut donc le désactiver le temps de l'émission.

**Étape 1 — désactiver temporairement le proxy Cloudflare**

DNS → Records → sur `levelupia.app` **et** `www` : Edit → Proxy status →
basculer sur **DNS only** (nuage gris) → Save. Attendre ~1 minute.

**Étape 2 — installer le certificat**

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d levelupia.app -d www.levelupia.app \
        --agree-tos -m contact@levelupia.tn --redirect
```

Certbot modifie tout seul `/etc/nginx/sites-available/levelupia.app` :
il ajoute le bloc `listen 443 ssl`, les chemins des certificats et la
redirection HTTP → HTTPS.

Vérifier :

```bash
nginx -t
ss -ltnp | grep 443            # nginx doit apparaître
curl -I https://levelupia.app/login
```

**Étape 3 — réactiver le proxy Cloudflare**

Remettre les deux enregistrements DNS en **Proxied** (nuage orange), puis dans
**SSL/TLS → Overview** choisir **Full (strict)** — le certificat Let's Encrypt
est valide, Cloudflare peut donc le vérifier.

**Renouvellement automatique** — certbot installe un timer systemd :

```bash
systemctl list-timers | grep certbot
certbot renew --dry-run          # tester le renouvellement
```

> Le renouvellement échouera si le proxy Cloudflare est actif au moment du
> renouvellement. Pour éviter cela durablement, utiliser la validation DNS :
> `apt install -y python3-certbot-dns-cloudflare` (nécessite un jeton API
> Cloudflare), ou repasser en DNS only pendant le renouvellement.

---

## 7. Pare-feu

```bash
ufw allow 22/tcp      # SSH — à ne jamais oublier
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Le port 3000 ne doit **pas** être ouvert publiquement : Nginx y accède en local.

---

## 8. Vérifications finales

```bash
node -v                              # >= 20
pm2 list                             # levelup : online, 1 seule ligne
curl -I http://localhost:3000/login  # 200
nginx -t                             # syntax ok
curl -I https://levelupia.app/login  # 200
```

Puis dans le navigateur : `https://levelupia.app` → connexion → déconnexion.
La déconnexion doit revenir sur `https://levelupia.app/login` (et non `localhost`).

---

## 9. Mettre à jour l'application

```bash
cd /root/app/platfomelevelup
git pull
npm install
npx prisma generate
npm run build
pm2 restart levelup
```

---

## Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| `Cannot find native binding` | Node < 20 | Installer Node 20+, `rm -rf node_modules package-lock.json && npm install` |
| Déconnexion renvoie vers `localhost:3000` | En-têtes proxy absents | Ajouter `X-Forwarded-Host` / `X-Forwarded-Proto` dans Nginx |
| Connexion impossible, boucle vers `/login` | Cookie `Secure` refusé en HTTP | Normal en HTTPS ; en HTTP le cookie s'adapte automatiquement. Forcer si besoin : `COOKIE_SECURE=false` |
| Connexion impossible derrière Cloudflare | Mode SSL Flexible | Passer en **Full** ou **Full (strict)** |
| `password authentication failed` | Mot de passe mal encodé | `@` → `%40`, `%` → `%25` (donc `%40` littéral → `%2540`) |
| 502 Bad Gateway | Application arrêtée | `pm2 logs levelup`, puis `pm2 restart levelup` |
| Upload de gros fichier en échec | Limite Nginx | `client_max_body_size 110M;` |
| Erreur **521** (Web server is down) | Rien n'écoute sur le port 443 alors que Cloudflare est en mode Full | Lancer certbot (section 6) ou, en dépannage immédiat, passer Cloudflare en **Flexible**. Vérifier : `ss -ltnp | grep 443` |
| `unknown directive "http2"` | nginx < 1.25 | Retirer la ligne `http2 on;` (ou écrire `listen 443 ssl http2;`) |
| certbot : `Timeout during connect` | Proxy Cloudflare actif pendant la validation | Passer les enregistrements DNS en **DNS only**, relancer certbot, puis remettre **Proxied** |
| `conflicting server name` au reload | Deux fichiers dans `sites-enabled` déclarent le même `server_name` | Supprimer le doublon : `rm /etc/nginx/sites-enabled/autre-domaine.tn` |
