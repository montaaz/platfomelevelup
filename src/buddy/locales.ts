import { formatDT } from "@/lib/format";
import type { Lang } from "./core/language";
import type { BuddyIntentId } from "./intents";
import { bullets, plural as pluralFr } from "./core/templates";

/**
 * Toutes les chaînes visibles de l'assistant, en français et en anglais.
 *
 * La plateforme n'a pas de système de traduction : ce module en tient lieu
 * pour l'assistant, côté serveur (gabarits) comme côté navigateur (widget).
 * Aucune chaîne visible n'est écrite dans un composant.
 */

export type Role = "ADMIN" | "CLIENT";

const plural = (lang: Lang, n: number, one: string, many?: string) =>
  lang === "fr" ? pluralFr(n, one, many) : `${n} ${n === 1 ? one : (many ?? `${one}s`)}`;

const dateFr = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};
const dateEn = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const DAY = 86_400_000;
const daysBetween = (from: Date, iso: string) => Math.round((new Date(iso).getTime() - from.getTime()) / DAY);

export type Strings = ReturnType<typeof build>;

function build(lang: Lang) {
  const fr = lang === "fr";
  const date = fr ? dateFr : dateEn;
  const n = (count: number, one: string, many?: string) => plural(lang, count, one, many);

  const projectStatus: Record<string, string> = fr
    ? { EN_ATTENTE_PAIEMENT: "en attente de paiement", EN_ATTENTE: "en attente", EN_COURS: "en cours", EN_REVISION: "en révision", LIVRE: "livré", CLOTURE: "clôturé" }
    : { EN_ATTENTE_PAIEMENT: "awaiting payment", EN_ATTENTE: "pending", EN_COURS: "in progress", EN_REVISION: "in review", LIVRE: "delivered", CLOTURE: "closed" };
  const invoiceStatus: Record<string, string> = fr
    ? { BROUILLON: "brouillon", EN_ATTENTE: "en attente", PAYEE: "payée", EN_RETARD: "en retard", ANNULEE: "annulée" }
    : { BROUILLON: "draft", EN_ATTENTE: "pending", PAYEE: "paid", EN_RETARD: "overdue", ANNULEE: "cancelled" };
  const orderStatus: Record<string, string> = fr
    ? { EN_ATTENTE_PAIEMENT: "en attente de paiement", PAYEE: "payée", ANNULEE: "annulée" }
    : { EN_ATTENTE_PAIEMENT: "awaiting payment", PAYEE: "paid", ANNULEE: "cancelled" };
  const approval: Record<string, string> = fr
    ? { EN_ATTENTE: "en attente de votre validation", APPROUVE: "approuvé", REVISION_DEMANDEE: "révision demandée" }
    : { EN_ATTENTE: "awaiting your approval", APPROUVE: "approved", REVISION_DEMANDEE: "revision requested" };
  const filterStatus: Record<string, string> = fr
    ? { PAYEE: "payées", EN_ATTENTE: "en attente", EN_RETARD: "en retard", ANNULEE: "annulées", EN_COURS: "en cours", EN_REVISION: "en révision", LIVRE: "livrés", CLOTURE: "clôturés" }
    : { PAYEE: "paid", EN_ATTENTE: "pending", EN_RETARD: "overdue", ANNULEE: "cancelled", EN_COURS: "in progress", EN_REVISION: "in review", LIVRE: "delivered", CLOTURE: "closed" };

  const period = (key: string): string => {
    const days = /^days:(\d+)$/.exec(key)?.[1];
    if (days) return fr ? `des ${days} derniers jours` : `from the last ${days} days`;
    const map: Record<string, string> = fr
      ? { today: "d'aujourd'hui", yesterday: "d'hier", thisWeek: "de cette semaine", lastWeek: "de la semaine dernière", thisMonth: "de ce mois", lastMonth: "du mois dernier", thisYear: "de cette année" }
      : { today: "from today", yesterday: "from yesterday", thisWeek: "from this week", lastWeek: "from last week", thisMonth: "from this month", lastMonth: "from last month", thisYear: "from this year" };
    return map[key] ?? key;
  };

  const intentLabel: Record<BuddyIntentId, string> = fr
    ? { help: "Aide", summary: "Résumé", project: "Projets", deadline: "Échéances", deliverables: "Livrables", download: "Téléchargements", revision: "Révision", approve: "Validation", orders: "Commandes", products: "Offres", review: "À vérifier", threads: "Messages", tasks: "Tâches", invoices: "Factures", profile: "Profil", human: "Parler à l'équipe", newProject: "Nouveau projet" }
    : { help: "Help", summary: "Summary", project: "Projects", deadline: "Deadlines", deliverables: "Deliverables", download: "Downloads", revision: "Revision", approve: "Approval", orders: "Orders", products: "Offers", review: "To review", threads: "Messages", tasks: "Tasks", invoices: "Invoices", profile: "Profile", human: "Talk to the team", newProject: "New project" };

  const intentQuestion: Record<BuddyIntentId, string> = fr
    ? { help: "Que sais-tu faire ?", summary: "Mon résumé", project: "Où en est mon projet ?", deadline: "Quand est-ce que ce sera prêt ?", deliverables: "Quels livrables sont disponibles ?", download: "Quels fichiers puis-je télécharger ?", revision: "Je veux demander une révision", approve: "Je veux approuver le livrable", orders: "Mes commandes", products: "Vos offres", review: "À vérifier", threads: "Messages de l'équipe", tasks: "Que dois-je faire ?", invoices: "Mes factures", profile: "Mon profil", human: "Parler à quelqu'un", newProject: "Nouveau projet" }
    : { help: "What can you do?", summary: "My summary", project: "Where is my project?", deadline: "When is it due?", deliverables: "Which deliverables are available?", download: "What can I download?", revision: "I want to request a revision", approve: "I want to approve the deliverable", orders: "My orders", products: "Your offers", review: "To review", threads: "Team messages", tasks: "What should I do?", invoices: "My invoices", profile: "My profile", human: "Talk to someone", newProject: "New project" };

  const suggestions = (role: Role): string[] =>
    role === "CLIENT"
      ? [intentQuestion.project, intentQuestion.deadline, intentQuestion.download, intentQuestion.invoices, intentQuestion.threads, intentQuestion.human]
      : fr
        ? ["Résumé de l'agence", "Commandes à encaisser", "Factures en retard", "À vérifier", "Dernières conversations", "Tâches en attente"]
        : ["Agency summary", "Orders to collect", "Overdue invoices", "To review", "Recent conversations", "Pending tasks"];

  return {
    lang,
    date,
    money: formatDT,
    n,
    period,
    projectStatus,
    invoiceStatus,
    orderStatus,
    approval,
    filterStatus,
    intentLabel,
    intentQuestion,
    suggestions,

    widget: fr
      ? { title: "Assistant", subtitle: "Vos projets, livrables, factures et messages — d'après vos données.", placeholder: "Votre question… (Entrée pour envoyer)", send: "Envoyer", clear: "Effacer la conversation", confirmClear: "Effacer votre conversation avec l'assistant ?", retry: "Réessayer", loading: "Un instant…", error: "Je n'ai pas pu répondre. Vérifiez votre connexion et réessayez.", intro: "Posez votre question, ou choisissez un sujet :", open: "Ouvrir l'assistant", close: "Fermer l'assistant" }
      : { title: "Assistant", subtitle: "Your projects, deliverables, invoices and messages — from your data.", placeholder: "Your question… (Enter to send)", send: "Send", clear: "Clear conversation", confirmClear: "Clear your conversation with the assistant?", retry: "Retry", loading: "One moment…", error: "I couldn't answer. Check your connection and try again.", intro: "Ask your question, or pick a topic:", open: "Open the assistant", close: "Close the assistant" },

    greeting: (firstName: string) => fr ? `Bonjour ${firstName} ! Que voulez-vous savoir ?` : `Hello ${firstName}! What would you like to know?`,
    thanks: fr ? "Avec plaisir. Autre chose ?" : "You're welcome. Anything else?",
    bye: fr ? "À bientôt ! Je reste ici si vous avez une question." : "See you soon! I'm here if you have a question.",
    help: fr ? "Voici ce que vous pouvez me demander :" : "Here is what you can ask me:",

    unauthorized: fr ? "Vous ne pouvez consulter que les données de votre propre compte." : "You can only see the data of your own account.",
    noEvidence: fr ? "Aucune donnée ne correspond pour l'instant." : "No data matches for now.",
    noProjects: fr ? "Vous n'avez pas encore de projet. Vous pouvez en lancer un en décrivant votre besoin." : "You don't have a project yet. You can start one by describing your need.",
    noSuchItem: (rank: number, count: number) => fr ? `Il n'y a pas de ${rank}ᵉ élément : la liste précédente en compte ${count}.` : `There is no item #${rank}: the previous list has ${count}.`,
    ambiguous: (options: string[]) => fr ? `Vouliez-vous dire : ${options.join(" ou ")} ? Précisez et je vous réponds.` : `Did you mean: ${options.join(" or ")}? Tell me and I'll answer.`,
    serverError: fr ? "Je n'ai pas pu lire vos données. Réessayez dans un instant." : "I couldn't read your data. Please try again in a moment.",

    notUnderstood: (snippet: string, options: string[]) =>
      fr
        ? `Je n'ai pas compris « ${snippet} ». ${options.length ? `Vouliez-vous parler de : ${options.join(", ")} ?` : "Pouvez-vous reformuler, ou choisir un sujet ci-dessous ?"}`
        : `I didn't understand “${snippet}”. ${options.length ? `Did you mean: ${options.join(", ")}?` : "Could you rephrase, or pick a topic below?"}`,
    notUnderstoodAgain: fr
      ? "Toujours pas compris, désolé. Reformulez en une phrase simple — ou écrivez directement à l'équipe, elle vous répondra."
      : "Still not clear, sorry. Try a simple sentence — or write to the team directly, they'll answer you.",

    clarifyProject: (titles: string[]) =>
      fr ? `De quel projet parlez-vous ? ${titles.join(" ou ")} ?` : `Which project do you mean? ${titles.join(" or ")}?`,

    /* ------------------------------ projets */
    projectLine: (p: { title: string; status: string; progress: number; nextStep: string | null }) =>
      `${p.title} — ${projectStatus[p.status] ?? p.status}, ${p.progress} %${p.nextStep ? (fr ? ` · prochaine étape : ${p.nextStep}` : ` · next step: ${p.nextStep}`) : ""}`,
    projectStatusReply: (p: { title: string; status: string; progress: number; nextStep: string | null; dueDate: string | null }, now: Date) => {
      const status = projectStatus[p.status] ?? p.status;
      const head = fr ? `${p.title} est ${status} (${p.progress} %).` : `${p.title} is ${status} (${p.progress}%).`;
      const next = p.nextStep ? (fr ? `Prochaine étape : ${p.nextStep}.` : `Next step: ${p.nextStep}.`) : (fr ? "Toutes les étapes sont franchies." : "All steps are complete.");
      return `${head} ${next}${p.dueDate ? ` ${dueLine(p.dueDate, now)}` : ""}`;
    },
    deadlineReply: (p: { title: string; dueDate: string | null; deliveredAt: string | null; status: string }, now: Date) => {
      if (p.deliveredAt) return fr ? `${p.title} a été livré le ${date(p.deliveredAt)}.` : `${p.title} was delivered on ${date(p.deliveredAt)}.`;
      if (!p.dueDate) return fr ? `Aucune échéance n'est encore fixée pour ${p.title}. L'équipe peut vous la préciser dans la messagerie.` : `No deadline is set yet for ${p.title}. The team can confirm it in Messages.`;
      return `${p.title} : ${dueLine(p.dueDate, now)}`;
    },
    projectsHeading: (count: number, suffix: string) => `${n(count, fr ? "projet" : "project")}${suffix} :`,
    projectsHint: fr ? "Demandez « où en est le projet … » pour le détail." : "Ask “where is project …” for details.",
    stepsReply: (p: { title: string; status: string; progress: number; steps: { label: string; reachedAt: string | null }[] }) =>
      `${p.title} — ${projectStatus[p.status] ?? p.status}, ${p.progress} %\n${bullets(p.steps.map((s) => `${s.reachedAt ? "✓" : "○"} ${s.label}${s.reachedAt ? ` — ${date(s.reachedAt)}` : ""}`))}`,

    /* ------------------------------ livrables */
    deliverablesReply: (items: { name: string; version: number; projectTitle: string; approval: string | null }[], showProject: boolean) =>
      `${n(items.length, fr ? "livrable disponible" : "available deliverable", fr ? "livrables disponibles" : "available deliverables")} :\n${bullets(items.map((d) => `${d.name} (v${d.version}${showProject ? `, ${d.projectTitle}` : ""})${d.approval ? ` — ${approval[d.approval] ?? d.approval}` : ""}`))}`,
    noDeliverables: (title?: string) => fr
      ? `${title ? `Aucun livrable n'a encore été déposé pour ${title}.` : "Aucun livrable n'est disponible pour l'instant."} Vous serez prévenu dès qu'un fichier arrive.`
      : `${title ? `No deliverable has been uploaded yet for ${title}.` : "No deliverable is available yet."} You'll be notified as soon as a file arrives.`,
    downloadReply: (count: number) => fr ? `Vous pouvez télécharger ${n(count, "fichier")} — cliquez sur son nom :` : `You can download ${n(count, "file")} — click its name:`,
    revisionReply: (d: { name: string; projectTitle: string } | null, title: string) => d
      ? (fr
        ? `Pour demander une révision de « ${d.name} » (${d.projectTitle}) : ouvrez votre tableau de bord, le bouton « Demander une révision » est sous le livrable. Décrivez ce qui doit changer ; l'équipe reçoit votre demande aussitôt.`
        : `To request a revision of “${d.name}” (${d.projectTitle}): open your dashboard, the “Request a revision” button sits under the deliverable. Describe what should change; the team gets your request right away.`)
      : (fr ? `Aucun livrable n'attend votre retour sur ${title} pour le moment.` : `No deliverable is waiting for your feedback on ${title} right now.`),
    approveReply: (d: { name: string; projectTitle: string } | null, title: string) => d
      ? (fr
        ? `Pour approuver « ${d.name} » (${d.projectTitle}) : ouvrez votre tableau de bord et cliquez sur « Approuver le livrable ». Cela lance la livraison finale.`
        : `To approve “${d.name}” (${d.projectTitle}): open your dashboard and click “Approve the deliverable”. That starts the final delivery.`)
      : (fr ? `Aucun livrable n'attend votre validation sur ${title} pour le moment.` : `No deliverable is awaiting your approval on ${title} right now.`),

    /* ------------------------------ humain, profil, messages */
    humanReply: (projectTitle: string | null) => fr
      ? `Bien sûr. L'équipe LevelUp IA vous répond en personne dans la messagerie${projectTitle ? ` du projet ${projectTitle}` : ""} : écrivez-lui, elle est prévenue aussitôt par notification et par e-mail.`
      : `Of course. The LevelUp IA team answers you in person in Messages${projectTitle ? ` for ${projectTitle}` : ""}: write to them, they're notified right away by notification and email.`,
    humanAdmin: fr ? "Vous êtes l'équipe : les clients vous écrivent dans la messagerie." : "You are the team: clients write to you in Messages.",
    profileReply: (p: { fullName: string; email: string; companyName: string; phone: string | null; address: string | null; city: string | null; country: string | null; complete: boolean }) =>
      [
        fr ? `Votre compte : ${p.fullName} · ${p.email}` : `Your account: ${p.fullName} · ${p.email}`,
        fr ? `Entreprise : ${p.companyName}` : `Company: ${p.companyName}`,
        `${fr ? "Téléphone" : "Phone"} : ${p.phone ?? (fr ? "non renseigné" : "not provided")}`,
        `${fr ? "Adresse" : "Address"} : ${[p.address, p.city, p.country].filter(Boolean).join(", ") || (fr ? "non renseignée" : "not provided")}`,
        p.complete ? "" : (fr ? "Complétez votre adresse et votre pays pour que vos factures soient établies correctement." : "Add your address and country so your invoices are issued correctly."),
      ].filter(Boolean).join("\n"),
    profileAdmin: fr ? "Votre profil administrateur se gère dans Équipe → Comptes." : "Your administrator profile is managed in Team → Accounts.",
    teamMessagesReply: (items: { senderName: string; body: string; projectTitle: string; createdAt: string }[], now: Date) =>
      items.length === 1
        ? `${fr ? "Dernier message de l'équipe" : "Latest message from the team"} (${items[0]!.projectTitle}, ${date(items[0]!.createdAt)}) :\n« ${items[0]!.body} »`
        : `${fr ? "Derniers messages de l'équipe" : "Latest messages from the team"} :\n${bullets(items.map((m) => `${m.projectTitle} · ${date(m.createdAt)} — « ${m.body} »`))}`,
    noTeamMessages: fr ? "L'équipe ne vous a pas encore écrit. Vous pouvez lui envoyer un message." : "The team hasn't written to you yet. You can send them a message.",

    /* ------------------------------ listes existantes */
    summaryClient: (s: { activeProjects: { title: string; status: string; progress: number; nextStep: string | null }[]; unpaidCount: number; unpaidTotal: number; unread: number; pendingOrders: number }) =>
      [
        fr ? `Vous avez ${n(s.activeProjects.length, "projet actif", "projets actifs")}.` : `You have ${n(s.activeProjects.length, "active project")}.`,
        s.activeProjects.length ? bullets(s.activeProjects.map((p) => `${p.title} — ${projectStatus[p.status] ?? p.status}, ${p.progress} %${p.nextStep ? (fr ? ` · prochaine étape : ${p.nextStep}` : ` · next step: ${p.nextStep}`) : ""}`)) : "",
        s.unpaidCount > 0 ? (fr ? `${n(s.unpaidCount, "facture à régler", "factures à régler")} : ${formatDT(s.unpaidTotal)}.` : `${n(s.unpaidCount, "invoice to pay", "invoices to pay")}: ${formatDT(s.unpaidTotal)}.`) : (fr ? "Aucune facture en attente." : "No invoice pending."),
        s.pendingOrders > 0 ? (fr ? `${n(s.pendingOrders, "commande en attente de paiement", "commandes en attente de paiement")}.` : `${n(s.pendingOrders, "order awaiting payment", "orders awaiting payment")}.`) : "",
        s.unread > 0 ? (fr ? `${n(s.unread, "message non lu", "messages non lus")}.` : `${n(s.unread, "unread message")}.`) : "",
      ].filter(Boolean).join("\n\n"),
    summaryAdmin: (s: { revenueMonth: number; projectsInProgress: number; unpaidCount: number; unpaidTotal: number; revisionRequests: number; pendingOrders: number; newRequests: number }) =>
      `${fr ? "Situation de l'agence" : "Agency status"} :\n${bullets([
        `${fr ? "Chiffre d'affaires du mois" : "Revenue this month"} : ${formatDT(s.revenueMonth)}`,
        n(s.projectsInProgress, fr ? "projet en cours" : "project in progress", fr ? "projets en cours" : "projects in progress"),
        `${n(s.unpaidCount, fr ? "facture impayée" : "unpaid invoice", fr ? "factures impayées" : "unpaid invoices")} : ${formatDT(s.unpaidTotal)}`,
        n(s.revisionRequests, fr ? "demande de révision" : "revision request", fr ? "demandes de révision" : "revision requests"),
        n(s.pendingOrders, fr ? "commande à encaisser" : "order to collect", fr ? "commandes à encaisser" : "orders to collect"),
        n(s.newRequests, fr ? "nouvelle demande de projet" : "new project request", fr ? "nouvelles demandes de projet" : "new project requests"),
      ])}`,
    ordersHeading: (count: number, suffix: string) => `${n(count, fr ? "commande" : "order")}${suffix} :`,
    orderDetail: (o: { id: string; packName: string; clientCompany: string; amount: number; status: string; createdAt: string; paidAt: string | null; paymentMethod: string | null; review: string[] }, showCompany: boolean) =>
      [
        `${fr ? "Commande" : "Order"} #${o.id} — ${o.packName}${showCompany ? ` (${o.clientCompany})` : ""}`,
        bullets([
          `${fr ? "Montant" : "Amount"} : ${formatDT(o.amount)}`,
          `${fr ? "Statut" : "Status"} : ${orderStatus[o.status] ?? o.status}`,
          `${fr ? "Passée le" : "Placed on"} ${date(o.createdAt)}`,
          o.paidAt ? `${fr ? "Payée le" : "Paid on"} ${date(o.paidAt)}` : (fr ? "Paiement non enregistré" : "Payment not recorded"),
        ]),
        o.review.length ? `⚠ ${fr ? "À vérifier" : "To review"} : ${o.review.join(", ")}` : "",
      ].filter(Boolean).join("\n\n"),
    invoicesHeading: (count: number, suffix: string, paid: number, unpaid: number) =>
      fr ? `${n(count, "facture")}${suffix} — payé : ${formatDT(paid)}, reste à régler : ${formatDT(unpaid)}.` : `${n(count, "invoice")}${suffix} — paid: ${formatDT(paid)}, remaining: ${formatDT(unpaid)}.`,
    invoiceLine: (i: { number: string; clientCompany: string; total: number; status: string; dueDate: string | null }, showCompany: boolean) =>
      `${i.number}${showCompany ? ` — ${i.clientCompany}` : ""} · ${formatDT(i.total)} · ${invoiceStatus[i.status] ?? i.status}${i.dueDate ? ` · ${fr ? "échéance" : "due"} ${date(i.dueDate)}` : ""}`,
    noUnpaid: fr ? "Vous n'avez aucune facture impayée." : "You have no unpaid invoice.",
    unpaidReply: (items: { number: string; total: number; status: string; dueDate: string | null }[]) =>
      `${fr ? `Oui — ${n(items.length, "facture", "factures")} à régler` : `Yes — ${n(items.length, "invoice")} to pay`} :\n${bullets(items.map((i) => `${i.number} · ${formatDT(i.total)} · ${invoiceStatus[i.status] ?? i.status}${i.dueDate ? ` · ${fr ? "échéance" : "due"} ${date(i.dueDate)}` : ""}`))}`,
    invoiceDetail: (i: { number: string; clientCompany: string; total: number; status: string; issueDate: string; dueDate: string | null; paidAt: string | null; projectTitle: string | null; review: string[] }, showCompany: boolean) =>
      [
        `${fr ? "Facture" : "Invoice"} ${i.number}${showCompany ? ` — ${i.clientCompany}` : ""}`,
        bullets([
          `${fr ? "Montant" : "Amount"} : ${formatDT(i.total)}`,
          `${fr ? "Statut" : "Status"} : ${invoiceStatus[i.status] ?? i.status}`,
          `${fr ? "Émise le" : "Issued on"} ${date(i.issueDate)}`,
          i.dueDate ? `${fr ? "Échéance le" : "Due on"} ${date(i.dueDate)}` : "",
          i.paidAt ? `${fr ? "Payée le" : "Paid on"} ${date(i.paidAt)}` : "",
          i.projectTitle ? `${fr ? "Projet" : "Project"} : ${i.projectTitle}` : "",
        ].filter(Boolean)),
        i.review.length ? `⚠ ${fr ? "À vérifier" : "To review"} : ${i.review.join(", ")}` : "",
      ].filter(Boolean).join("\n\n"),
    threadsHeading: (count: number, suffix: string) => `${n(count, fr ? "conversation récente" : "recent conversation", fr ? "conversations récentes" : "recent conversations")}${suffix} :`,
    threadLine: (t: { projectTitle: string; clientCompany: string; lastSenderName: string; lastMessage: string; unread: number }, showCompany: boolean) =>
      `${t.projectTitle}${showCompany ? ` — ${t.clientCompany}` : ""} · ${t.lastSenderName.split(" ")[0]} : « ${t.lastMessage} »${t.unread > 0 ? ` · ${n(t.unread, fr ? "non lu" : "unread", fr ? "non lus" : "unread")}` : ""}`,
    threadDetail: (t: { projectTitle: string; clientCompany: string; lastSenderName: string; lastMessage: string; lastAt: string; unread: number }, showCompany: boolean) =>
      `${t.projectTitle}${showCompany ? ` — ${t.clientCompany}` : ""}\n${fr ? "Dernier message" : "Last message"}, ${date(t.lastAt)}, ${fr ? "de" : "from"} ${t.lastSenderName} :\n« ${t.lastMessage} »`,
    tasksReply: (items: { label: string; clientCompany: string }[], showCompany: boolean) =>
      items.length === 0
        ? (fr ? "Rien en attente de votre part pour le moment." : "Nothing is waiting on you right now.")
        : `${n(items.length, fr ? "tâche en attente" : "pending task", fr ? "tâches en attente" : "pending tasks")} :\n${bullets(items.map((t) => `${t.label}${showCompany ? ` — ${t.clientCompany}` : ""}`))}`,
    reviewNone: fr ? "Rien à vérifier : tous les enregistrements consultés sont complets." : "Nothing to review: every record checked is complete.",
    reviewHeading: (count: number) => `⚠ ${n(count, fr ? "enregistrement à vérifier manuellement" : "record to review manually", fr ? "enregistrements à vérifier manuellement" : "records to review manually")} :`,
    newProjectClient: fr
      ? "Pour lancer un nouveau projet, ouvrez « Nouveau projet » et décrivez votre besoin — site, vidéo, shooting, identité visuelle, chatbot… L'équipe l'étudie et vous répond dans votre messagerie."
      : "To start a new project, open “New project” and describe your need — website, video, shoot, visual identity, chatbot… The team reviews it and answers in your messages.",
    newProjectAdmin: fr
      ? "Pour créer un projet : Projets → « Nouveau projet », puis choisissez le client, le service et le prix."
      : "To create a project: Projects → “New project”, then pick the client, the service and the price.",
    offersFooter: fr
      ? "Pour commander : choisissez l'offre sur levelupia.agency (« Ajouter au panier »), elle apparaîtra dans vos projets. Pour un conseil sur mesure, écrivez à l'équipe."
      : "To order: pick the offer on levelupia.agency (“Add to cart”), it will appear in your projects. For tailored advice, write to the team.",
    offers: fr
      ? { includes: "Comprend :", others: (need: string) => `Pour « ${need} », d'autres offres le comprennent aussi :`, forNeed: (need: string) => `Pour « ${need} », voici ce qui correspond :`, budget: (b: number) => `Avec un budget de ${formatDT(b)}, voici ce que vous pouvez choisir :`, budgetNone: (b: number, min: number) => `Aucun pack n'entre dans un budget de ${formatDT(b)} — le premier commence à ${formatDT(min)}.`, monthly: "Et en formule mensuelle :", compare: "Comparaison :", both: "Les deux comprennent :", onlyIn: (t: string) => `En plus dans ${t} :`, noStock: "Nous ne gérons pas de stock : nos offres sont des prestations. Les voici :", list: (c: number) => `${n(c, "offre")} :`, hint: "Demandez-moi une offre par son nom pour le détail, ou dites-moi votre besoin ou votre budget.", perMonth: " / mois" }
      : { includes: "Includes:", others: (need: string) => `For “${need}”, other offers include it too:`, forNeed: (need: string) => `For “${need}”, here is what matches:`, budget: (b: number) => `With a budget of ${formatDT(b)}, here is what you can choose:`, budgetNone: (b: number, min: number) => `No pack fits a budget of ${formatDT(b)} — the first one starts at ${formatDT(min)}.`, monthly: "And as a monthly plan:", compare: "Comparison:", both: "Both include:", onlyIn: (t: string) => `Only in ${t}:`, noStock: "We don't manage stock: our offers are services. Here they are:", list: (c: number) => `${n(c, "offer")}:`, hint: "Ask me about an offer by name for details, or tell me your need or budget.", perMonth: " / month" },

    /* ------------------------------ boutons */
    actions: fr
      ? { home: "Voir le livrable", messages: "Écrire à l'équipe", thread: (title: string) => `Écrire à l'équipe — ${title}`, profile: "Modifier mon profil", newProject: "Ouvrir « Nouveau projet »", adminProjects: "Ouvrir « Projets »", invoices: "Voir mes factures", download: (name: string) => `⬇ ${name}` }
      : { home: "See the deliverable", messages: "Write to the team", thread: (title: string) => `Write to the team — ${title}`, profile: "Edit my profile", newProject: "Open “New project”", adminProjects: "Open “Projects”", invoices: "See my invoices", download: (name: string) => `⬇ ${name}` },
  };

  function dueLine(dueIso: string, now: Date): string {
    const days = daysBetween(now, dueIso);
    const when = date(dueIso);
    if (fr) {
      if (days < 0) return `Échéance le ${when} — dépassée de ${n(-days, "jour")}.`;
      if (days === 0) return `Échéance aujourd'hui (${when}).`;
      return `Échéance le ${when} — dans ${n(days, "jour")}.`;
    }
    if (days < 0) return `Due ${when} — ${n(-days, "day")} overdue.`;
    if (days === 0) return `Due today (${when}).`;
    return `Due ${when} — in ${n(days, "day")}.`;
  }
}

const cache: Partial<Record<Lang, Strings>> = {};
export function L(lang: Lang): Strings {
  return (cache[lang] ??= build(lang));
}
