# Intégration site vitrine → plateforme

`levelupia.agency` (vitrine) → `levelupia.app` (plateforme)

## Le parcours

```
Ajouter au panier  →  POST /api/cart        →  jeton signé + signupUrl
      ↓
Inscription (levelupia.app/inscription?cart=…)
      ↓
Commande créée, accès FERMÉ  →  écran « Paiement en attente »
      ↓
Admin confirme l'encaissement (Commandes)
      ↓
Accès OUVERT + projet (ou abonnement) + facture payée créés automatiquement
```

## Règle de sécurité

Le navigateur ne transmet **jamais** un prix ni un statut de paiement — seulement
un **code d'offre**, dans un jeton signé (HS256, valable 1 h, émetteur et
destinataire vérifiés). Le prix est relu dans la table `packs` côté serveur.
Un jeton forgé est refusé, une origine non autorisée est refusée, et seul un
admin peut confirmer un paiement.

## Côté site vitrine — le seul code à ajouter

Le composant `ServicePackCard` émet déjà `levelup:add-to-cart`. Il suffit
d'écouter cet événement :

```ts
// src/app/layout.tsx (ou un composant client monté globalement)
const PLATFORM = "https://levelupia.app";

/** Code d'offre attendu par la plateforme, à partir du numéro de pack. */
const PACK_CODES: Record<string, string> = {
  "PACK 01": "PACK_DECOUVERTE",
  "PACK 02": "PACK_LANCEMENT",
  "PACK 03": "PACK_CROISSANCE",
  "PACK 04": "PACK_PRO_MAX",
};

document.addEventListener("levelup:add-to-cart", async (e) => {
  const detail = (e as CustomEvent<{ id: string; title: string; price: string }>).detail;
  e.preventDefault(); // empêche le repli vers #contact

  const packCode = PACK_CODES[detail.id];
  if (!packCode) return;

  const res = await fetch(`${PLATFORM}/api/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packCode }),
  });
  const data = await res.json();
  if (data.signupUrl) window.location.href = data.signupUrl;
});
```

Pour les **abonnements mensuels**, mêmes codes : `ABO_STARTER`, `ABO_PRO`,
`ABO_SOCIAL`.

### Afficher les prix officiels (facultatif)

`GET https://levelupia.app/api/cart` renvoie le catalogue (code, nom, prix,
mensuel ou non). Utile pour que le vitrine et la plateforme ne divergent jamais.

## Configuration de la plateforme (`.env`)

```bash
CART_TOKEN_SECRET="<32+ caractères aléatoires>"   # openssl rand -base64 32
VITRINE_ORIGINS="https://levelupia.agency"        # origines autorisées (CORS)
APP_URL="https://levelupia.app"                   # base des signupUrl
```

## Le catalogue

| Code | Offre | Prix |
|---|---|---|
| `PACK_DECOUVERTE` | Pack Découverte | 890 TND |
| `PACK_LANCEMENT` | Pack Lancement | 1 890 TND |
| `PACK_CROISSANCE` | Pack Croissance | 3 490 TND |
| `PACK_PRO_MAX` | Pack Pro Max | 4 900 TND |
| `ABO_STARTER` | Abonnement Starter | 1 190 TND/mois |
| `ABO_PRO` | Abonnement Pro | 1 490 TND/mois |
| `ABO_SOCIAL` | Gestion des réseaux sociaux | 290 TND/mois |

Les prix se modifient en base (`UPDATE packs SET price = … WHERE code = …`) :
aucune mise en production n'est nécessaire.

## Paiement en ligne — ClicToPay (Attijari E-Payment)

```
« Payer par carte »  →  POST /api/paiement/demarrer  →  page de carte de la banque
      ↓
Retour du client     →  /api/paiement/retour (accepté) ou /api/paiement/echec (refusé)
Notification banque  →  /api/paiement/notification (serveur à serveur)
      ↓
Statut relu auprès de la banque  →  commande PAYEE + facture + e-mail à l'équipe
```

Adresses à déclarer sur la fiche technique de la banque :

| Champ | Valeur |
|---|---|
| URL de notification | `https://levelupia.app/api/paiement/notification` |
| URL de retour si le paiement est accepté | `https://levelupia.app/api/paiement/retour` |
| URL de retour si le paiement est refusé | `https://levelupia.app/api/paiement/echec` |

Aucune de ces adresses n'est crue sur parole : elles indiquent seulement quelle
transaction relire. Le résultat et le montant sont redemandés à la banque
(`getOrderStatusExtended.do`) avant d'encaisser, et une commande ne peut être
encaissée qu'une fois.

Mise en service (`.env` de la plateforme, puis redémarrage) :

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/012_paiement_en_ligne.sql

CLICTOPAY_BASE_URL="https://test.clictopay.com/payment/rest"   # production : https://ipay.clictopay.com/payment/rest
CLICTOPAY_USERNAME="<identifiant marchand fourni par la banque>"
CLICTOPAY_PASSWORD="<mot de passe marchand>"
PAYMENT_NOTIFY_EMAIL="contact@levelupia.agency"

# envoi des e-mails par la boîte professionnelle (Google Workspace)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="contact@levelupia.agency"
SMTP_PASS="<mot de passe d'application Google>"
```

Tant que `CLICTOPAY_USERNAME` / `CLICTOPAY_PASSWORD` sont absents, le bouton
« Payer par carte » n'apparaît pas et la confirmation manuelle par l'admin
reste le seul chemin.
