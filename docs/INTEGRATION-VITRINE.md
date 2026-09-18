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

## Quand la banque sera intégrée

Un seul point à brancher : le webhook de la passerelle appelle, **côté serveur**,
`confirmOrderPayment(order, méthode, référence)` — la même fonction que le
bouton admin. Tout le reste (ouverture de l'accès, création du projet, de
l'abonnement et de la facture) est déjà en place et ne change pas.
