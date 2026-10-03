/**
 * Accès au modèle de langage local (Ollama), installé sur le même serveur.
 *
 * Rien ne sort de la machine : l'adresse doit être une boucle locale
 * (127.0.0.1, localhost, ::1), toute autre valeur désactive l'IA. Sans
 * BUDDY_AI=on, l'assistant reste purement à règles — c'est aussi le mode des
 * tests. Chaque appel a un délai court ; après une panne, le modèle est mis
 * de côté une minute pour ne pas ralentir chaque message.
 *
 *   BUDDY_AI=on
 *   OLLAMA_URL=http://127.0.0.1:11434      (défaut)
 *   BUDDY_AI_MODEL=qwen2.5:3b              (défaut)
 *   BUDDY_EMBED_MODEL=bge-m3               (défaut ; "off" pour s'en passer)
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatOptions = {
  /** true : JSON libre ; un schéma JSON : sortie contrainte à ce schéma (valeurs d'une liste fermée, par exemple). */
  json?: boolean | Record<string, unknown>;
  maxTokens: number;
  temperature?: number;
  timeoutMs: number;
};

/** Ce dont l'assistant a besoin d'un modèle — de quoi le remplacer par un faux dans les tests. */
export interface LocalModel {
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<string>;
  /** Vecteurs des textes, ou null si aucun modèle d'embeddings n'est configuré. */
  embed(texts: string[], timeoutMs: number): Promise<number[][] | null>;
}

export type AIConfig = { url: string; chatModel: string; embedModel: string | null };

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function readAIConfig(env: Record<string, string | undefined> = process.env): AIConfig | null {
  if (!/^(1|on|true|yes|ollama)$/i.test(env.BUDDY_AI ?? "")) return null;
  let url: URL;
  try {
    url = new URL(env.OLLAMA_URL || "http://127.0.0.1:11434");
  } catch {
    console.error("[buddy-ai] OLLAMA_URL invalide : IA désactivée.");
    return null;
  }
  if (!LOOPBACK.has(url.hostname) || !/^https?:$/.test(url.protocol)) {
    console.error("[buddy-ai] OLLAMA_URL doit pointer sur ce serveur (127.0.0.1) : IA désactivée.");
    return null;
  }
  const embed = (env.BUDDY_EMBED_MODEL ?? "bge-m3").trim();
  return {
    url: url.origin,
    chatModel: (env.BUDDY_AI_MODEL || "qwen2.5:3b").trim(),
    embedModel: embed && !/^(off|none|0)$/i.test(embed) ? embed : null,
  };
}

const PAUSE_MS = 60_000;

export function ollamaModel(cfg: AIConfig): LocalModel {
  // Une pause par service : un modèle d'embeddings absent ne doit pas couper la conversation.
  const pausedUntil = new Map<string, number>();

  async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    if (Date.now() < (pausedUntil.get(path) ?? 0)) throw new Error("modèle local en pause après une panne");
    try {
      const res = await fetch(`${cfg.url}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      // Un délai dépassé n'est pas une panne : le message suivant réessaie.
      if (!(e instanceof Error && e.name === "TimeoutError")) pausedUntil.set(path, Date.now() + PAUSE_MS);
      throw e;
    }
  }

  return {
    async chat(messages, opts) {
      const data = await post<{ message?: { content?: string } }>(
        "/api/chat",
        {
          model: cfg.chatModel,
          messages,
          stream: false,
          keep_alive: "24h",
          ...(opts.json ? { format: opts.json === true ? "json" : opts.json } : {}),
          options: { temperature: opts.temperature ?? 0, num_predict: opts.maxTokens, num_ctx: 4096 },
        },
        opts.timeoutMs,
      );
      return data.message?.content ?? "";
    },
    async embed(texts, timeoutMs) {
      if (!cfg.embedModel || texts.length === 0) return null;
      const data = await post<{ embeddings?: number[][] }>("/api/embed", { model: cfg.embedModel, input: texts, keep_alive: "24h" }, timeoutMs);
      return Array.isArray(data.embeddings) && data.embeddings.length === texts.length ? data.embeddings : null;
    },
  };
}

let shared: LocalModel | null | undefined;

/** Le modèle configuré pour ce process, ou null si l'IA est désactivée. */
export function configuredModel(): LocalModel | null {
  if (shared === undefined) {
    const cfg = readAIConfig();
    shared = cfg ? ollamaModel(cfg) : null;
    if (cfg) console.info(`[buddy-ai] modèle local ${cfg.chatModel} sur ${cfg.url}${cfg.embedModel ? ` · recherche ${cfg.embedModel}` : ""}`);
  }
  return shared;
}
