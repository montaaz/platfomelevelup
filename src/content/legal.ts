/**
 * Conditions générales d'utilisation et de vente — COPIE de la version
 * française publiée par le site vitrine (levelup-ai/src/content/legal.ts).
 * Les deux fichiers doivent rester identiques : la page /conditions de la
 * plateforme est celle que le client accepte à la création de son compte.
 */

export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] };

/** Coordonnées de l'éditeur, reprises dans les deux documents et le pied de page. */
export const PUBLISHER = {
  brand: "LevelUp AI",
  site: "https://levelupia.agency",
  platform: "https://levelupia.app",
  email: "contact@levelupia.agency",
  /* À compléter avec l'extrait RNE : raison sociale, forme, capital, siège, matricule fiscal. */
  legalName: "LevelUp AI",
  address: "Tunisie",
};

const UPDATED_FR = "7 octobre 2026";

export const TERMS_FR: LegalDoc = {
  title: "Conditions générales d'utilisation et de vente",
  updated: `Dernière mise à jour : ${UPDATED_FR}`,
  intro:
    "Les présentes conditions régissent l'utilisation du site levelupia.agency, de l'espace client levelupia.app et l'achat des prestations de LevelUp AI. Toute commande vaut acceptation sans réserve de ces conditions.",
  sections: [
    {
      heading: "1. Éditeur et contact",
      paragraphs: [
        `Le site levelupia.agency et la plateforme levelupia.app sont édités par ${PUBLISHER.legalName}, ${PUBLISHER.address}.`,
        `Contact : ${PUBLISHER.email}. Les demandes commerciales, techniques et les réclamations passent par cette adresse ou par la messagerie de l'espace client.`,
      ],
    },
    {
      heading: "2. Objet",
      paragraphs: [
        "LevelUp AI est une agence de marketing digital assistée par l'intelligence artificielle. Elle propose des prestations de création de sites web, de vidéos commerciales générées par IA, de création digitale (branding, contenu, SEO) et d'automatisation d'entreprise, vendues sous forme de packs à prix fixe ou d'abonnements mensuels.",
        "Le détail de chaque pack et abonnement (contenu, livrables, prix) figure sur la page Tarifs du site et dans l'espace client au moment de la commande.",
      ],
    },
    {
      heading: "3. Prix",
      paragraphs: [
        "Les prix sont exprimés en dinars tunisiens (TND), toutes taxes comprises (TVA 19 % incluse). Le site peut afficher une conversion indicative dans une autre devise ; seul le montant en dinars indiqué dans l'espace client au moment du paiement fait foi.",
        "LevelUp AI peut modifier ses prix à tout moment ; le prix applicable est celui affiché au moment de la commande. Une facture est émise pour chaque paiement et reste disponible dans l'espace client.",
      ],
    },
    {
      heading: "4. Commande",
      paragraphs: [
        "Le client choisit une offre sur le site, l'ajoute à son panier et finalise sa commande. Il est alors dirigé vers le paiement puis vers la création de son espace client (ou sa connexion s'il en possède déjà un).",
        "La commande est ferme à l'acceptation du paiement. Le client reçoit une confirmation dans son espace et par e-mail, et son projet y apparaît avec son état d'avancement.",
      ],
    },
    {
      heading: "5. Paiement",
      paragraphs: [
        "Le paiement s'effectue en ligne par carte bancaire (cartes nationales et internationales) sur la page de paiement sécurisée de la plateforme monétique ClicToPay. LevelUp AI n'a jamais accès aux numéros de carte : la saisie se fait exclusivement sur la page de la banque, protégée par chiffrement et 3-D Secure.",
        "Le paiement par virement bancaire reste possible sur demande ; la prestation démarre alors à réception des fonds.",
        "En cas de refus de paiement par la banque, aucune commande n'est enregistrée et aucun montant n'est débité. Le client peut renouveler sa tentative depuis son espace.",
      ],
    },
    {
      heading: "6. Exécution et livraison",
      paragraphs: [
        "Les prestations sont des services numériques livrés dans l'espace client sous forme de fichiers, d'accès ou de mises en ligne. Chaque projet suit cinq étapes visibles par le client : Brief reçu, Production, Première version, Votre validation, Livraison finale.",
        "Les délais indicatifs sont communiqués lors du cadrage du projet. Ils courent à compter de la réception des éléments nécessaires fournis par le client (textes, visuels, accès). Un retard du client décale d'autant la livraison.",
        "Le client dispose de la première version pour formuler ses retours ; une série d'ajustements est comprise dans chaque pack, dans le périmètre de l'offre commandée. Toute demande hors périmètre fait l'objet d'un devis.",
      ],
    },
    {
      heading: "7. Annulation et remboursement",
      paragraphs: [
        "Pack (prestation ponctuelle) : le client peut annuler sans frais tant que la production n'a pas démarré. Le montant payé est alors intégralement remboursé sous 14 jours ouvrés, par le même moyen de paiement. Une fois la production démarrée, les travaux réalisés restent dus ; le solde éventuel est remboursé au prorata.",
        "Abonnement mensuel : résiliable à tout moment depuis l'espace client ou par e-mail. La résiliation prend effet à la fin de la période déjà payée ; le mois entamé n'est pas remboursé.",
        "En cas de prestation non conforme à la commande, le client la signale selon le processus de réclamation ; LevelUp AI corrige la prestation ou rembourse la partie non conforme.",
      ],
    },
    {
      heading: "8. Obligations du client",
      paragraphs: [
        "Le client garantit disposer des droits sur tous les éléments qu'il fournit (textes, images, logos, vidéos, accès) et répond de leur contenu. Il s'engage à fournir des informations exactes lors de la création de son compte et à garder ses identifiants confidentiels.",
        "Il s'interdit toute utilisation du site ou de l'espace client contraire à la loi, à l'ordre public ou aux droits de tiers.",
      ],
    },
    {
      heading: "9. Propriété intellectuelle",
      paragraphs: [
        "Les livrables finaux sont la propriété du client à compter du paiement intégral de la prestation. LevelUp AI conserve ses méthodes, outils, modèles et savoir-faire, et peut citer le projet comme référence sauf refus écrit du client.",
        "Le site, sa charte graphique, ses textes et ses vidéos restent la propriété de LevelUp AI et ne peuvent être reproduits sans autorisation.",
      ],
    },
    {
      heading: "10. Données personnelles",
      paragraphs: [
        "Les données collectées (identité, coordonnées, informations sur l'entreprise, historique des commandes et des échanges) servent uniquement à l'exécution des prestations, à la facturation et au suivi de la relation client. Elles ne sont ni vendues ni cédées.",
        "Les données de paiement sont traitées exclusivement par la banque et la plateforme monétique ; LevelUp AI n'en conserve que la référence de transaction.",
        `Conformément à la loi organique n° 2004-63 relative à la protection des données à caractère personnel, le client peut accéder à ses données, les rectifier ou en demander la suppression en écrivant à ${PUBLISHER.email}.`,
      ],
    },
    {
      heading: "11. Responsabilité",
      paragraphs: [
        "LevelUp AI met en œuvre les moyens nécessaires à la bonne exécution des prestations. Sa responsabilité ne peut être engagée pour les contenus fournis par le client, pour l'usage que celui-ci fait des livrables, ni pour les interruptions dues à des services tiers (hébergeurs, réseaux sociaux, plateformes de paiement).",
        "En tout état de cause, la responsabilité de LevelUp AI est limitée au montant de la prestation concernée.",
      ],
    },
    {
      heading: "12. Réclamations et litiges",
      paragraphs: [
        "Toute réclamation est traitée selon le processus publié sur la page « Réclamations » du site : accusé de réception sous 2 jours ouvrés, réponse sous 7 jours ouvrés.",
        "Les présentes conditions sont soumises au droit tunisien. À défaut de solution amiable, les tribunaux tunisiens compétents sont seuls habilités à connaître du litige.",
      ],
    },
  ],
};

