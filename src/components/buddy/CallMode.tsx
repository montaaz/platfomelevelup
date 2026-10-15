"use client";

import { useEffect, useRef, useState } from "react";
import { isConfirmation, isDenial, type Proposal } from "@/lib/assistantActions";

type Phase = "listening" | "thinking" | "speaking" | "muted";
type Line = { role: "user" | "bot"; text: string };

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
function speechRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Appel vocal avec l'assistant : on parle naturellement, une pause envoie,
 * l'assistant répond à voix haute (Baarcha) et on peut l'interrompre.
 * Les actions qu'il propose (panier, demande, message) ne partent qu'après
 * « Confirmer » — bouton ou « oui » à l'oral.
 */
export function CallMode({
  context,
  onContext,
  onTurn,
  onClose,
  lang = "fr",
}: {
  context: unknown;
  onContext: (c: unknown) => void;
  onTurn: (line: Line & { proposal?: Proposal; href?: string }) => void;
  onClose: () => void;
  lang?: "fr" | "en";
}) {
  const [phase, setPhase] = useState<Phase>("listening");
  const [live, setLive] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [projectChoice, setProjectChoice] = useState<string>("");
  const [longPauses, setLongPauses] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [supported] = useState(() => !!speechRecognition());
  const rec = useRef<Rec | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const active = useRef(true);
  const busy = useRef(false);
  const phaseRef = useRef<Phase>("listening");
  const ctxRef = useRef(context);
  const proposalRef = useRef<Proposal | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const longRef = useRef(false);
  longRef.current = longPauses;
  ctxRef.current = context;
  proposalRef.current = proposal;

  function setPh(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  /* ---------------- voix de l'assistant ---------------- */
  function stopSpeaking() {
    if (audio.current) {
      audio.current.pause();
      audio.current = null;
    }
  }
  async function speak(text: string) {
    stopSpeaking();
    try {
      const res = await fetch("/api/buddy/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok || !active.current) return;
      const data = (await res.json()) as { audio: string; mimeType: string };
      const a = new Audio(`data:${data.mimeType};base64,${data.audio}`);
      audio.current = a;
      setPh("speaking");
      await new Promise<void>((resolve) => {
        a.onended = () => resolve();
        a.onerror = () => resolve();
        a.play().catch(() => resolve());
      });
    } catch {
      /* voix indisponible : le texte reste affiché */
    } finally {
      if (audio.current) audio.current = null;
      if (active.current && phaseRef.current === "speaking") setPh("listening");
    }
  }

  /* ---------------- un tour ---------------- */
  async function send(text: string, audioBlob?: Blob) {
    if (busy.current || !active.current) return;
    const heard = text.trim();
    if (!heard && !audioBlob) return;
    busy.current = true;
    setLive("");
    setPh("thinking");

    // Confirmation / refus à l'oral d'une action proposée.
    const pending = proposalRef.current;
    if (pending && heard) {
      if (isConfirmation(heard)) {
        push({ role: "user", text: heard });
        await runProposal(pending);
        busy.current = false;
        return;
      }
      if (isDenial(heard)) {
        push({ role: "user", text: heard });
        setProposal(null);
        const t = lang === "en" ? "Fine, nothing done." : "Très bien, je ne fais rien.";
        push({ role: "bot", text: t });
        await speak(t);
        busy.current = false;
        if (active.current) setPh("listening");
        return;
      }
      setProposal(null); // autre chose : la proposition tombe
    }

    try {
      const form = new FormData();
      if (heard) form.set("message", heard);
      else if (audioBlob) form.set("audio", audioBlob, "appel.webm");
      form.set("context", JSON.stringify(ctxRef.current ?? null));
      const res = await fetch("/api/buddy/call", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; heard?: string; context?: unknown; proposal?: Proposal; error?: string; actions?: { label: string; href: string }[] };
      if (!res.ok || !data.text) {
        const t = data.error ?? "Je n'ai pas pu répondre.";
        setNotice(t);
        busy.current = false;
        if (active.current) setPh("listening");
        return;
      }
      if (data.heard && !heard) push({ role: "user", text: data.heard });
      else if (heard) push({ role: "user", text: heard });
      if (data.context !== undefined) onContext(data.context);
      push({ role: "bot", text: data.text });
      onTurn({ role: "bot", text: data.text, proposal: data.proposal });
      if (data.proposal) {
        setProposal(data.proposal);
        if (data.proposal.action === "SEND_MESSAGE" && data.proposal.choices?.length) setProjectChoice(data.proposal.choices[0]!.id);
      }
      await speak(data.text);
    } catch {
      setNotice("Connexion interrompue.");
    } finally {
      busy.current = false;
      if (active.current && phaseRef.current !== "muted") setPh("listening");
    }
  }

  function push(line: Line) {
    setLines((prev) => [...prev.slice(-8), line]);
    if (line.role === "user") onTurn(line);
  }

  async function runProposal(p: Proposal) {
    setPh("thinking");
    const payload: Record<string, unknown> = { confirm: true, action: p.action };
    if (p.action === "ADD_TO_CART") payload.packCode = p.packCode;
    if (p.action === "CREATE_REQUEST") { payload.title = p.title; payload.description = p.description; }
    if (p.action === "SEND_MESSAGE") { payload.projectId = p.projectId ?? projectChoice; payload.body = p.body; }
    try {
      const res = await fetch("/api/buddy/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json()) as { text?: string; href?: string; error?: string };
      const t = res.ok && data.text ? data.text : (data.error ?? "Action impossible pour le moment.");
      setProposal(null);
      push({ role: "bot", text: t });
      onTurn({ role: "bot", text: t, href: res.ok ? data.href : undefined });
      await speak(t);
    } catch {
      setNotice("Connexion interrompue.");
    } finally {
      if (active.current) setPh("listening");
    }
  }

  /* ---------------- écoute ---------------- */
  function armTimer(text: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (text.trim() && phaseRef.current === "listening") void send(text);
    }, longRef.current ? 2600 : 1300);
  }

  function startRecognition() {
    const SR = speechRecognition();
    if (!SR || !active.current) return;
    try { rec.current?.abort(); } catch { /* ignore */ }
    const r = new SR();
    r.lang = lang === "en" ? "en-US" : "fr-FR";
    r.continuous = true;
    r.interimResults = true;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += `${t} `;
        else interim += t;
      }
      const all = `${finalText}${interim}`.trim();
      if (all && phaseRef.current === "speaking") stopSpeaking(); // le client coupe l'assistant
      if (phaseRef.current === "thinking") return; // on attend la réponse en cours
      setLive(all);
      if (phaseRef.current !== "listening") setPh("listening");
      armTimer(finalText || all);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setNotice("Micro refusé : autorisez le microphone (icône 🔒 à gauche de l'adresse).");
    };
    r.onend = () => {
      // Chrome coupe l'écoute après un silence : on la relance tant que l'appel dure.
      if (active.current && phaseRef.current !== "muted") setTimeout(() => { try { r.start(); } catch { startRecognition(); } }, 150);
    };
    try { r.start(); } catch { /* déjà démarré */ }
    rec.current = r;
  }

  useEffect(() => {
    active.current = true;
    if (supported) startRecognition();
    const hello = lang === "en" ? "Hello, I'm listening. Tell me what you need." : "Bonjour, je vous écoute. Dites-moi ce dont vous avez besoin.";
    push({ role: "bot", text: hello });
    void speak(hello);
    return () => {
      active.current = false;
      try { rec.current?.abort(); } catch { /* ignore */ }
      stopSpeaking();
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() {
    if (phase === "muted") {
      setPh("listening");
      startRecognition();
    } else {
      try { rec.current?.abort(); } catch { /* ignore */ }
      rec.current = null;
      setPh("muted");
    }
  }

  /* ---------------- sans reconnaissance navigateur : parler en maintenant le bouton ---------------- */
  async function pushToTalkStart() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); void send("", new Blob(chunks.current, { type: mr.mimeType || "audio/webm" })); };
      mr.start(400);
      recorder.current = mr;
      stopSpeaking();
      setPh("listening");
    } catch {
      setNotice("Micro refusé : autorisez le microphone.");
    }
  }
  function pushToTalkStop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
  }

  const status =
    phase === "thinking" ? (lang === "en" ? "Preparing reply…" : "Je réfléchis…")
      : phase === "speaking" ? (lang === "en" ? "Speaking… (you can interrupt)" : "Je parle… (vous pouvez m'interrompre)")
        : phase === "muted" ? (lang === "en" ? "Microphone off" : "Micro coupé")
          : (lang === "en" ? "Listening…" : "Je vous écoute…");

  return (
    <div className="call-overlay" role="dialog" aria-label="Appel avec l'assistant">
      <div className="call-card">
        <div className="call-head"><span className="call-brand">LEVEL UP IA</span><span className="call-tag">Appel en direct</span></div>
        <div className={`call-orb call-orb-${phase}`} aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <p className="call-status">{status}</p>
        <p className="call-hint">{supported ? "Parlez naturellement. Une pause envoie. Vous pouvez interrompre à tout moment." : "Maintenez le bouton « Parler » enfoncé, puis relâchez pour envoyer (transcription Baarcha)."}</p>
        {supported && (
          <label className="call-check"><input type="checkbox" checked={longPauses} onChange={(e) => setLongPauses(e.target.checked)} /> Autoriser des pauses plus longues</label>
        )}

        <div className="call-log">
          {lines.map((l, i) => (
            <p key={i} className={l.role === "user" ? "call-you" : "call-bot"}><span>{l.role === "user" ? "Vous" : "Assistant"}</span>{l.text}</p>
          ))}
          {live && <p className="call-you call-live"><span>Vous</span>{live}</p>}
        </div>

        {proposal && (
          <div className="call-proposal">
            <p className="call-proposal-title">{proposal.label}</p>
            <p className="call-proposal-text">{proposal.summary}</p>
            {proposal.action === "SEND_MESSAGE" && proposal.choices && proposal.choices.length > 0 && (
              <select value={projectChoice} onChange={(e) => setProjectChoice(e.target.value)} className="call-select" aria-label="Projet concerné">
                {proposal.choices.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
            <div className="call-proposal-actions">
              <button type="button" className="call-btn call-btn-ok" onClick={() => void runProposal(proposal)}>Confirmer</button>
              <button type="button" className="call-btn" onClick={() => setProposal(null)}>Annuler</button>
            </div>
            <p className="call-proposal-note">Rien n&apos;est fait sans votre confirmation. Les validations (paiement, statut…) restent faites par l&apos;équipe.</p>
          </div>
        )}

        {notice && <p className="call-notice" role="alert">{notice}</p>}

        <div className="call-controls">
          {supported ? (
            <button type="button" className={`call-round${phase === "muted" ? " call-round-on" : ""}`} onClick={toggleMute}>
              <span aria-hidden="true">🎙</span>{phase === "muted" ? "Réactiver" : "Couper le micro"}
            </button>
          ) : (
            <button type="button" className="call-round" onPointerDown={() => void pushToTalkStart()} onPointerUp={pushToTalkStop} onPointerLeave={pushToTalkStop}>
              <span aria-hidden="true">🎙</span>Parler
            </button>
          )}
          <button type="button" className="call-round call-round-end" onClick={onClose}><span aria-hidden="true">📞</span>Raccrocher</button>
        </div>
        <p className="call-foot">La conversation reste dans votre fil d&apos;assistant. Quitter la page termine l&apos;appel.</p>
      </div>
    </div>
  );
}
