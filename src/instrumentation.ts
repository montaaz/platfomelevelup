/**
 * Démarrage du serveur Next : si l'assistant IA local est activé
 * (BUDDY_AI=on), on prépare le modèle en arrière-plan pour que le premier
 * client n'attende pas son chargement. Sans effet sinon.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { configuredModel } = await import("@/buddy/ai/model");
  const model = configuredModel();
  if (!model) return;
  const { warmUp } = await import("@/buddy/ai/assist");
  void warmUp(model).catch(() => { /* le premier message réessaiera */ });
}
