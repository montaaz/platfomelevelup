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
 *
 * Second fournisseur : l'API Baarcha (https://baarcha.tn, modèle Hannibal —
 * français, anglais et tunisien), compatible OpenAI. Même interface, même
 * garde-fou (guard.ts) : seul le moteur change. Pas d'embeddings chez Baarcha,
 * la recherche d'extraits se fait alors par mots.
 *
 *   BUDDY_AI=baarcha
 *   BAARCHA_API_KEY=pk_live_…
 *   BAARCHA_API_URL=https://baarcha.tn/api/v1   (défaut)
 *   BAARCHA_MODEL=hannibal                      (défaut)
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
export type BaarchaConfig = { url: string; apiKey: string; chatModel: string };

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Configuration Baarcha, ou null si BUDDY_AI ne la désigne pas ou si la clé manque. */
export function readBaarchaConfig(env: Record<string, string | undefined> = process.env): BaarchaConfig | null {
  if (!/^baarcha$/i.test(env.BUDDY_AI ?? "")) return null;
  const apiKey = (env.BAARCHA_API_KEY ?? "").trim();
  if (!apiKey) {
    console.error("[buddy-ai] BAARCHA_API_KEY manquante : IA désactivée.");
    return null;
  }
  let url: URL;
  try {
    url = new URL(env.BAARCHA_API_URL || "https://baarcha.tn/api/v1");
  } catch {
    console.error("[buddy-ai] BAARCHA_API_URL invalide : IA désactivée.");
    return null;
  }
  if (url.protocol !== "https:") {
    console.error("[buddy-ai] BAARCHA_API_URL doit être en https : IA désactivée.");
    return null;
  }
  return { url: url.toString().replace(/\/+$/, ""), apiKey, chatModel: (env.BAARCHA_MODEL || "hannibal").trim() };
}

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

/**
 * Baarcha : API « chat/completions » compatible OpenAI. La sortie JSON n'y est
 * pas contrainte par une grammaire comme chez Ollama : on la demande dans les
 * consignes et on extrait le premier objet JSON de la réponse ; l'appelant
 * vérifie de toute façon que la valeur appartient à sa liste.
 */
export function baarchaModel(cfg: BaarchaConfig): LocalModel {
  let pausedUntil = 0;

  return {
    async chat(messages, opts) {
      if (Date.now() < pausedUntil) throw new Error("Baarcha en pause après une panne");
      const wantJson = !!opts.json;
      const sent: ChatMessage[] = wantJson
        ? messages.map((m, i) =>
            i === 0 && m.role === "system"
              ? { ...m, content: `${m.content}\nRéponds uniquement par un objet JSON, sans texte autour.` }
              : m,
          )
        : messages;
      let res: Response;
      try {
        res = await fetch(`${cfg.url}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: cfg.chatModel,
            messages: sent,
            stream: false,
            max_tokens: opts.maxTokens,
            temperature: opts.temperature ?? 0,
          }),
          signal: AbortSignal.timeout(opts.timeoutMs),
          cache: "no-store",
        });
      } catch (e) {
        if (!(e instanceof Error && e.name === "TimeoutError")) pausedUntil = Date.now() + PAUSE_MS;
        throw e;
      }
      if (res.status === 429) throw new Error("Baarcha : limite de requêtes atteinte");
      if (!res.ok) {
        // 401/403 : clé invalide — inutile de réessayer à chaque message.
        if (res.status === 401 || res.status === 403 || res.status >= 500) pausedUntil = Date.now() + PAUSE_MS;
        throw new Error(`Baarcha ${res.status}`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!wantJson) return text;
      const match = text.match(/\{[\s\S]*\}/);
      return match ? match[0] : text;
    },
    // Pas de modèle d'embeddings chez Baarcha : la recherche d'extraits reste lexicale.
    async embed() {
      return null;
    },
  };
}

let shared: LocalModel | null | undefined;

/** Le modèle configuré pour ce process, ou null si l'IA est désactivée. */
export function configuredModel(): LocalModel | null {
  if (shared === undefined) {
    const baarcha = readBaarchaConfig();
    if (baarcha) {
      shared = baarchaModel(baarcha);
      console.info(`[buddy-ai] modèle Baarcha ${baarcha.chatModel} (${baarcha.url})`);
    } else {
      const cfg = readAIConfig();
      shared = cfg ? ollamaModel(cfg) : null;
      if (cfg) console.info(`[buddy-ai] modèle local ${cfg.chatModel} sur ${cfg.url}${cfg.embedModel ? ` · recherche ${cfg.embedModel}` : ""}`);
    }
  }
  return shared;
}
