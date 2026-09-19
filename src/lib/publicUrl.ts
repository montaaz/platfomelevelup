/**
 * Adresse publique de l'application, telle que le navigateur doit la voir.
 *
 * Derrière Nginx, l'application écoute un port interne (3000) que le monde
 * extérieur ne peut pas joindre. Ce port se glisse dans les redirections par
 * deux chemins : un `APP_URL` mal recopié, ou un en-tête `X-Forwarded-Host`
 * que Nginx transmet avec le port. Dans les deux cas, le visiteur atterrit
 * sur « https://levelupia.app:3000/… » et la page ne charge jamais.
 *
 * Ce module vit dans lib/ et n'utilise que des API standard : le middleware
 * s'exécute sur le runtime Edge et ne peut pas importer les services serveur.
 */

/**
 * Retire le port d'un hôte public.
 *
 * En HTTPS, un port explicite est presque toujours l'erreur décrite ci-dessus :
 * le vrai service écoute 443. En HTTP on le conserve, car le développement
 * local (`localhost:3000`) en dépend.
 */
export function stripInternalPort(host: string, protocol: string): string {
  const isSecure = protocol.startsWith("https");
  if (!isSecure) return host;
  // Un hôte IPv6 s'écrit entre crochets : « [::1]:3000 ».
  const match = /^(\[[^\]]+\]|[^:]+)(?::\d+)?$/.exec(host.trim());
  return match ? match[1]! : host;
}

/** Même nettoyage, appliqué à une URL complète (« https://site.app:3000 »). */
export function stripPublicPort(base: string): string {
  try {
    const u = new URL(base);
    if (u.protocol === "https:" && u.port) u.port = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return base;
  }
}

/**
 * Hôte et protocole publics d'une requête, d'après les en-têtes du proxy.
 *
 * `X-Forwarded-Proto` peut contenir une liste (« https,http ») lorsque
 * plusieurs proxys se succèdent : seul le premier compte, c'est celui vu par
 * le navigateur.
 */
export function publicOrigin(headers: {
  get(name: string): string | null;
}): { host: string; protocol: string } {
  const rawHost = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const host = rawHost.split(",")[0]!.trim();
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isLocal = host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("[::1]");
  const protocol = forwardedProto ?? (isLocal ? "http" : "https");
  return { host: stripInternalPort(host, protocol), protocol };
}
