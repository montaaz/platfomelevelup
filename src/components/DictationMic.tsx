"use client";

import { useEffect, useRef, useState } from "react";
import { appendDictation } from "@/lib/dictation";

type Status = "idle" | "listening" | "thinking" | "error";

/* Reconnaissance vocale du navigateur (Chrome, Edge, Safari) : typage minimal. */
type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void;
};
function speechRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Micro de dictée pour un champ texte. Pendant l'écoute, ce que le navigateur
 * reconnaît s'écrit en direct dans le champ ; à l'arrêt, le texte est envoyé
 * au modèle Baarcha qui le corrige (orthographe, grammaire, ponctuation) et
 * remplace la version provisoire. Sans reconnaissance dans le navigateur,
 * l'audio est enregistré et transcrit par Baarcha (« fennec »).
 */
export function DictationMic({
  value,
  onChange,
  context,
  lang = "fr",
  className = "",
  size = 30,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Intitulé du champ : aide le modèle à corriger dans le bon contexte. */
  context?: string;
  lang?: "fr" | "en" | "auto";
  className?: string;
  size?: number;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const base = useRef("");
  const heard = useRef("");
  const rec = useRef<Rec | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stopping = useRef(false);
  const latestValue = useRef(value);
  latestValue.current = value;

  useEffect(() => {
    setSupported(!!speechRecognition() || (typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia));
  }, []);

  async function finish(audio: Blob | null) {
    setStatus("thinking");
    setMessage("Correction par l'IA…");
    try {
      const form = new FormData();
      form.set("hint", heard.current);
      form.set("context", context ?? "");
      form.set("lang", lang);
      if (audio && audio.size > 0 && !heard.current) form.set("audio", audio, "dictee.webm");
      const res = await fetch("/api/dictee", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; corrected?: boolean; error?: string };
      if (!res.ok || !data.text) {
        setStatus("error");
        setMessage(data.error ?? "Dictée impossible.");
        onChange(appendDictation(base.current, heard.current)); // on garde au moins ce qui a été entendu
        return;
      }
      onChange(appendDictation(base.current, data.text));
      setStatus("idle");
      setMessage(data.corrected ? "Texte corrigé par l'IA ✓" : "Texte ajouté ✓");
    } catch {
      setStatus("error");
      setMessage("Connexion interrompue.");
      onChange(appendDictation(base.current, heard.current));
    } finally {
      setTimeout(() => setMessage(null), 3500);
    }
  }

  async function start() {
    setMessage(null);
    base.current = latestValue.current;
    heard.current = "";
    stopping.current = false;
    const SR = speechRecognition();

    // Enregistrement audio en parallèle : sert à Baarcha si le navigateur ne reconnaît rien.
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setStatus("error");
      const name = (e as { name?: string })?.name ?? "";
      if (name === "NotFoundError" || name === "OverconstrainedError") setMessage("Aucun microphone détecté sur cet appareil.");
      else if (name === "NotReadableError") setMessage("Le micro est utilisé par une autre application.");
      else if (name === "NotAllowedError" || name === "SecurityError") {
        // Refus mémorisé par le navigateur : il ne redemande pas tant que le site n'est pas réautorisé.
        let denied = false;
        try {
          const st = await navigator.permissions?.query({ name: "microphone" as PermissionName });
          denied = st?.state === "denied";
        } catch { /* API absente */ }
        setMessage(denied
          ? "Micro bloqué pour ce site : cliquez sur l'icône 🔒 (ou 🎤) à gauche de l'adresse, autorisez le microphone, puis réessayez."
          : "Micro refusé : cliquez sur « Autoriser » quand le navigateur le demande.");
      } else setMessage("Micro indisponible dans ce navigateur.");
      return;
    }
    chunks.current = [];
    try {
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        stream?.getTracks().forEach((t) => t.stop());
        void finish(new Blob(chunks.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start(500);
      recorder.current = mr;
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
    }

    if (SR) {
      const r = new SR();
      r.lang = lang === "en" ? "en-US" : "fr-FR";
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        let final = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i]!;
          const t = res[0]?.transcript ?? "";
          if (res.isFinal) final += `${t} `;
          else interim += t;
        }
        heard.current = final.trim();
        onChange(appendDictation(base.current, `${final}${interim}`.trim()));
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed") setMessage("Micro refusé : autorisez le microphone.");
      };
      r.onend = () => {
        if (!stopping.current && status === "listening") {
          try { r.start(); } catch { /* fin de session */ }
        }
      };
      try { r.start(); } catch { /* déjà démarré */ }
      rec.current = r;
    }
    setStatus("listening");
    setMessage(SR ? "Je vous écoute… parlez, puis cliquez pour terminer." : "Enregistrement… cliquez pour terminer.");
    // Sécurité : au plus 2 minutes par dictée.
    setTimeout(() => { if (recorder.current?.state === "recording") stop(); }, 120_000);
  }

  function stop() {
    stopping.current = true;
    try { rec.current?.stop(); } catch { /* ignore */ }
    rec.current = null;
    if (recorder.current && recorder.current.state === "recording") recorder.current.stop();
    else void finish(null);
    recorder.current = null;
  }

  if (!supported) return null;
  const listening = status === "listening";
  return (
    <span className={`dictation ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={() => (listening ? stop() : void start())}
        disabled={status === "thinking"}
        aria-pressed={listening}
        aria-label={listening ? "Arrêter la dictée" : "Dicter ce champ au micro"}
        title={listening ? "Arrêter la dictée" : "Dicter au micro (IA Baarcha)"}
        className={`dictation-btn${listening ? " dictation-on" : ""}${status === "thinking" ? " dictation-busy" : ""}`}
        style={{ width: size, height: size }}
      >
        {status === "thinking" ? (
          <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth={2.2} className="dictation-spin" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
          </svg>
        )}
      </button>
      {message && <span className={`dictation-msg${status === "error" ? " dictation-err" : ""}`} role="status">{message}</span>}
    </span>
  );
}
