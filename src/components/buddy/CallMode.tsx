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
  const rec = useRef<Rec | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const active = useRef(true);
  const busy = useRef(false);
  const phaseRef = useRef<Phase>("listening");
  const ctxRef = useRef(context);
  const proposalRef = useRef<Proposal | null>(null);
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
    if (timer.current) clearTimeout(timer.current);

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
      // À l'oral, pas de « sujet ci-dessous » : on dicte des exemples.
      if ((data as { kind?: string }).kind === "refusal" && /ci-dessous|below/.test(data.text)) {
        const ex = (Array.isArray((data as { suggestions?: string[] }).suggestions) ? (data as { suggestions?: string[] }).suggestions! : []).slice(0, 3);
        data.text = lang === "en"
          ? `I didn't catch that. You can ask me for example: ${ex.join(", ") || "where my project stands, my invoices, my orders"}.`
          : `Je n'ai pas compris. Vous pouvez me demander par exemple : ${ex.join(", ") || "où en est mon projet, mes factures, mes commandes"}.`;
      }
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

  /* ---------------- écoute : détection de voix (toujours) + reconnaissance navigateur (si elle répond) ---------------- */
  const srText = useRef("");          // phrases finales reçues du navigateur depuis le dernier envoi
  const srSeen = useRef(0);           // nombre de résultats déjà pris en compte
  const srWorks = useRef(false);      // le navigateur a livré au moins un résultat (Chrome, Edge, Safari)
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const vadTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seg = useRef<{ rec: MediaRecorder | null; chunks: Blob[]; startedAt: number; lastVoice: number; active: boolean }>({ rec: null, chunks: [], startedAt: 0, lastVoice: 0, active: false });
  const noise = useRef(0.004);
  const [mode, setMode] = useState<"navigateur" | "baarcha">("baarcha");

  function pauseMs() { return longRef.current ? 2600 : 1300; }

  /** Fin d'un segment de parole : texte du navigateur s'il en a donné, sinon l'audio part à Baarcha. */
  function closeSegment() {
    const sg = seg.current;
    if (!sg.active) return;
    sg.active = false;
    const text = srText.current.trim();
    srText.current = "";
    const rec = sg.rec;
    sg.rec = null;
    if (text) {
      try { rec?.stop(); } catch { /* ignore */ }
      void send(text);
      return;
    }
    if (rec && rec.state === "recording") {
      rec.onstop = () => {
        const blob = new Blob(sg.chunks, { type: rec.mimeType || "audio/webm" });
        sg.chunks = [];
        if (blob.size > 2000) void send("", blob);
      };
      rec.stop();
    }
  }

  function openSegment() {
    const sg = seg.current;
    if (sg.active || !stream.current) return;
    stopSpeaking(); // le client prend la parole : l'assistant se tait
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus" : "";
    try {
      const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
      sg.chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) sg.chunks.push(e.data); };
      rec.start(250);
      sg.rec = rec;
    } catch {
      sg.rec = null;
    }
    sg.active = true;
    sg.startedAt = Date.now();
    sg.lastVoice = Date.now();
    srText.current = "";
    if (phaseRef.current === "speaking") setPh("listening");
  }

  async function startListening() {
    if (!active.current) return;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      setNotice(name === "NotFoundError" ? "Aucun microphone détecté." : "Micro refusé : autorisez le microphone (icône 🔒 à gauche de l'adresse), puis relancez l'appel.");
      return;
    }
    // Détection de voix : niveau sonore mesuré 20 fois par seconde, seuil adapté au bruit ambiant.
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)!;
    const ac = new AC();
    audioCtx.current = ac;
    const source = ac.createMediaStreamSource(stream.current);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    vadTimer.current = setInterval(() => {
      if (!active.current || phaseRef.current === "muted") return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
      const rms = Math.sqrt(sum / buf.length);
      const sg = seg.current;
      if (!sg.active) noise.current = noise.current * 0.95 + rms * 0.05; // bruit de fond, mis à jour hors parole
      const threshold = Math.max(0.012, noise.current * 3) * (phaseRef.current === "speaking" ? 2.2 : 1);
      const now = Date.now();
      if (rms > threshold) {
        if (phaseRef.current === "thinking") return; // réponse en cours : on attend
        if (!sg.active) openSegment();
        sg.lastVoice = now;
        if (now - sg.startedAt > 300) setLive((v) => v || "…");
      } else if (sg.active && now - sg.lastVoice > pauseMs()) {
        if (now - sg.startedAt < 600) { // trop court : un bruit, pas une phrase
          sg.active = false;
          try { sg.rec?.stop(); } catch { /* ignore */ }
          sg.rec = null;
          setLive("");
        } else closeSegment();
      } else if (sg.active && now - sg.startedAt > 60_000) closeSegment(); // au plus une minute par prise de parole
    }, 50);
    startRecognition();
  }

  function startRecognition() {
    const SR = speechRecognition();
    if (!SR || !active.current) return;
    try { rec.current?.abort(); } catch { /* ignore */ }
    const r = new SR();
    r.lang = lang === "en" ? "en-US" : "fr-FR";
    r.continuous = true;
    r.interimResults = true;
    srSeen.current = 0;
    r.onresult = (e) => {
      let finals = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = (res[0]?.transcript ?? "").trim();
        if (!t) continue;
        if (res.isFinal) { if (i >= srSeen.current) { finals += `${t} `; } }
        else interim += `${t} `;
      }
      if (finals) { srText.current = `${srText.current} ${finals}`.trim(); srSeen.current = e.results.length; }
      if (!srWorks.current) { srWorks.current = true; setMode("navigateur"); }
      const shown = `${srText.current} ${interim}`.trim();
      if (shown) setLive(shown);
      if (phaseRef.current === "speaking") stopSpeaking();
      if (!seg.current.active && shown) openSegment(); // micro trop discret pour la détection : la reconnaissance suffit
      seg.current.lastVoice = Date.now();
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setNotice("Micro refusé : autorisez le microphone (icône 🔒 à gauche de l'adresse).");
      // "network" / "service-not-allowed" (Brave, Firefox…) : la détection de voix + Baarcha prennent le relais.
    };
    r.onend = () => {
      if (active.current && phaseRef.current !== "muted") setTimeout(() => { try { r.start(); } catch { /* fin */ } }, 200);
    };
    try { r.start(); } catch { /* déjà démarré */ }
    rec.current = r;
  }

  function stopListening() {
    try { rec.current?.abort(); } catch { /* ignore */ }
    rec.current = null;
    if (vadTimer.current) clearInterval(vadTimer.current);
    vadTimer.current = null;
    const sg = seg.current;
    sg.active = false;
    try { sg.rec?.stop(); } catch { /* ignore */ }
    sg.rec = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
  }

  useEffect(() => {
    active.current = true;
    void startListening();
    const hello = lang === "en" ? "Hello, I'm listening. Tell me what you need." : "Bonjour, je vous écoute. Dites-moi ce dont vous avez besoin.";
    push({ role: "bot", text: hello });
    void speak(hello);
    return () => {
      active.current = false;
      stopListening();
      stopSpeaking();
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() {
    if (phase === "muted") {
      setPh("listening");
      void startListening();
    } else {
      stopListening();
      setPh("muted");
    }
  }

  const status =
    phase === "thinking" ? (lang === "en" ? "Preparing reply…" : "Je réfléchis…")
      : phase === "speaking" ? (lang === "en" ? "Speaking… (you can interrupt)" : "Je parle… (vous pouvez m'interrompre)")
        : phase === "muted" ? (lang === "en" ? "Microphone off" : "Micro coupé")
          : (lang === "en" ? "Listening…" : "Je vous écoute…");

  return (
    <div className="call-overlay" role="dialog" aria-label="Appel avec l'assistant">
      <div className="call-card">
        <div className="call-head"><span className="call-brand">LEVEL UP AI</span><span className="call-tag">Appel en direct</span></div>
        <div className={`call-orb call-orb-${phase}`} aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <p className="call-status">{status}</p>
        <p className="call-hint">Parlez naturellement. Une pause envoie. Vous pouvez interrompre à tout moment.<br /><span className="call-mode">{mode === "navigateur" ? "Reconnaissance : navigateur, correction IA Baarcha" : "Transcription : IA Baarcha"}</span></p>
        <label className="call-check"><input type="checkbox" checked={longPauses} onChange={(e) => setLongPauses(e.target.checked)} /> Autoriser des pauses plus longues</label>

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
          <button type="button" className={`call-round${phase === "muted" ? " call-round-on" : ""}`} onClick={toggleMute}>
            <span aria-hidden="true">🎙</span>{phase === "muted" ? "Réactiver" : "Couper le micro"}
          </button>
          <button type="button" className="call-round call-round-end" onClick={onClose}><span aria-hidden="true">📞</span>Raccrocher</button>
        </div>
        <p className="call-foot">La conversation reste dans votre fil d&apos;assistant. Quitter la page termine l&apos;appel.</p>
      </div>
    </div>
  );
}
