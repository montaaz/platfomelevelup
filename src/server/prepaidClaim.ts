import { forgetPrepaidPayment, readPrepaidPayment, rememberPrepaidPayment } from "@/lib/session";
import { ctxOrNull } from "@/server/context";
import { claimPrepaidPayment, type GatewayReturn } from "@/server/services/prepaid";

/**
 * À appeler dès qu'un client est identifié (inscription, connexion, Google) :
 * si son navigateur porte un paiement fait depuis le panier du site vitrine,
 * il devient sa commande payée. Renvoie true quand une commande a été créée —
 * l'appelant ne doit alors pas en créer une seconde, impayée, pour la même offre.
 */
export async function claimPrepaidFromCookie(clientId: bigint | string | null | undefined): Promise<boolean> {
  if (clientId == null) return false;
  const prepaidId = await readPrepaidPayment();
  if (!prepaidId) return false;
  const claimed = await claimPrepaidPayment(BigInt(clientId), prepaidId);
  // En cas d'échec le cookie reste : le rattachement sera retenté à la prochaine connexion.
  if (claimed) await forgetPrepaidPayment();
  return claimed;
}

/**
 * Où envoyer le client après un paiement accepté. Pour une commande de
 * l'espace client, c'est terminé. Pour un paiement fait depuis le panier du
 * site vitrine, il reste à le rattacher à un compte : tout de suite si le
 * client est déjà connecté, sinon après l'inscription — le cookie garde le
 * paiement, et l'offre voyage dans le lien comme pour une commande classique.
 */
export async function afterPaidLocation(result: GatewayReturn): Promise<string> {
  if (!result.prepaid) return "/paiement/succes";
  await rememberPrepaidPayment(result.prepaid.id);
  const ctx = await ctxOrNull("CLIENT");
  if (ctx && (await claimPrepaidFromCookie(ctx.clientId))) return "/paiement/succes";
  return `/inscription?pack=${encodeURIComponent(result.prepaid.packCode)}&paye=1`;
}
