import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const APP_USER     = "Vaprio";
const APP_PASS     = "Stella Azzurra";
const ROSTER_ROLES = ["Palleggiatore","Schiacciatore","Centrale","Opposto","Libero","Universale"];
const ROT_RUOLI_S  = ["Pal","Sch1","Cen1","Opp","Sch2","Cen2"];
const FRONT_ROW    = [4, 3, 2];
const BACK_ROW     = [5, 6, 1];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getRuoloS = (pos, sp) => ROT_RUOLI_S[((pos - sp + 6) % 6)];
const rotaA     = r  => [...r.slice(1), r[0]];
const nextSP    = sp => ((sp - 2 + 6) % 6) + 1;
const posOrder  = sp => Array.from({ length: 6 }, (_, i) => ((sp - 1 + i) % 6) + 1);
const checkWin  = (a, b, n) => { const m = n >= 5 ? 15 : 25; return Math.max(a,b) >= m && Math.abs(a-b) >= 2; };
const getServer = rot => rot[0];
const uid       = () => Math.random().toString(36).slice(2, 10);
const todayStr  = () => { const d = new Date(); return `${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; };
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k)    => { try { localStorage.removeItem(k); } catch {} },
};

// ─── SETUP CAMPO ──────────────────────────────────────────────────────────────
function CampoSetup({ rot, sp, highlight, interactive, onSelect, roster = [] }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #1e3a5f" }}>
      <div style={{ background: "#0d2137", textAlign: "center", fontSize: 10, color: "#4d9fdb", padding: "3px 0", letterSpacing: 2, fontWeight: 700 }}>▲ RETE ▲</div>
      {[[4,3,2],[5,6,1]].map((row, ri) => (
        <div key={ri} style={{ display: "flex" }}>
          {row.map(pos => {
            const j = rot[pos - 1], isSP = pos === sp, isHL = pos === highlight;
            const p = roster.find(r => r.jersey === j);
            return (
              <div key={pos} onClick={() => interactive && onSelect?.(pos)}
                style={{ flex: 1, padding: "6px 2px", textAlign: "center", background: isSP ? "#1a3a1a" : isHL ? "#1a2a3a" : "#0a1929", borderRight: "1px solid #1e3a5f", borderBottom: ri === 0 ? "1px solid #1e3a5f" : "none", cursor: interactive ? "pointer" : "default" }}>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: isSP ? "#22c55e" : isHL ? "#60a5fa" : "#e2e8f0" }}>
                  {j ? `#${j}` : interactive ? pos : "—"}
                </div>
                {p && <div style={{ fontSize: 8, color: "#4d7fa8", lineHeight: 1 }}>{p.name}</div>}
                {sp && <div style={{ fontSize: 8, color: isSP ? "#16a34a" : "#2d5a7a" }}>{getRuoloS(pos, sp)}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── SCORE FLASH ──────────────────────────────────────────────────────────────
function ScoreFlash({ score, team, flash }) {
  return (
    <span style={{ display: "inline-block", fontSize: 46, fontWeight: 900, letterSpacing: -2, fontFamily: "'Courier New',monospace", color: team === "A" ? "#60a5fa" : "#fb923c", transition: "transform 0.1s", transform: flash ? "scale(1.18)" : "scale(1)", textShadow: flash ? (team === "A" ? "0 0 20px #60a5fa88" : "0 0 20px #fb923c88") : "none" }}>
      {score}
    </span>
  );
}

// ─── STATS TABLE ──────────────────────────────────────────────────────────────
function StatsTable({ jerseys, statsMap, roster }) {
  if (!jerseys.length) return <div style={{ textAlign: "center", color: "#4d7fa8", padding: 14, fontSize: 13 }}>Nessun dato</div>;
  const C = ({ v, col }) => <div style={{ textAlign: "center", fontWeight: 700, fontSize: 12, color: (v && v !== "—" && v !== 0) ? col : "#1e3a5f" }}>{v ?? 0}</div>;
  return (
    <div style={{ background: "#0d1f35", borderRadius: 12, overflow: "hidden", border: "1px solid #1e3a5f" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr .55fr .55fr .55fr .55fr .65fr .65fr", background: "#060e1a", padding: "6px 8px", gap: 2 }}>
        {["Giocatrice","Pt","Ace","Err","Batt","%Ace","%Err"].map(h => <div key={h} style={{ fontSize: 8, color: "#4d7fa8", fontWeight: 700, textAlign: "center" }}>{h}</div>)}
      </div>
      {jerseys.map(j => {
        const p = roster.find(r => r.jersey === j) || { name: "" };
        const st = statsMap[j] || { punti: 0, ace: 0, errori: 0, erroriServ: 0, battute: 0 };
        const pA = st.battute > 0 ? `${Math.round(st.ace / st.battute * 100)}%` : "—";
        const pE = st.battute > 0 ? `${Math.round(st.erroriServ / st.battute * 100)}%` : "—";
        return (
          <div key={j} style={{ display: "grid", gridTemplateColumns: "1.4fr .55fr .55fr .55fr .55fr .65fr .65fr", padding: "7px 8px", borderTop: "1px solid #1e2d3d", gap: 2 }}>
            <div><div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 11, color: "#e2e8f0" }}>#{j}</div><div style={{ fontSize: 8, color: "#4d7fa8" }}>{p.name}</div></div>
            <C v={st.punti} col="#60a5fa" /><C v={st.ace} col="#22c55e" /><C v={st.errori} col="#ef4444" />
            <C v={st.battute} col="#94a3b8" /><C v={pA} col="#22c55e" /><C v={pE} col="#f97316" />
          </div>
        );
      })}
    </div>
  );
}

// ─── POSITION CARD ────────────────────────────────────────────────────────────
function PositionCard({ pos, jersey, playerName, isP1, isLib, isServing, serve,
  onAttack, onError, onAce, onServeError, onGenericError,
  tapMode, selected, isCorrectSrc, onTap }) {

  const stop = fn => e => { e.stopPropagation(); fn(); };
  const canServeBtns = isP1 && serve === "A" && !isLib;

  const ABT = ({ onClick, bg, children, disabled }) => (
    <button onClick={disabled ? undefined : onClick} style={{
      background: disabled ? "#111" : bg, border: "none", borderRadius: 5,
      color: disabled ? "#2a2a2a" : "#fff", fontWeight: 700, fontSize: 11,
      padding: "5px 2px", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.3 : 1, flex: 1, lineHeight: 1.2, textAlign: "center",
    }}>{children}</button>
  );

  const borderCol = selected ? "#60a5fa" : isCorrectSrc ? "#a855f7" : isP1 && serve === "A" ? "#2563eb88" : "#1e3a5f";
  const bgCol     = selected ? "#1a3a5a" : isCorrectSrc ? "#2a1a3a" : isP1 ? "#0e1e38" : "#0a1422";

  return (
    <div onClick={tapMode ? () => onTap(pos) : undefined}
      style={{ background: bgCol, border: `2px solid ${borderCol}`, borderRadius: 8,
        display: "flex", flexDirection: "column", gap: 3, padding: "3px",
        cursor: tapMode ? "pointer" : "default", position: "relative",
        transition: "border-color 0.2s, background 0.2s" }}>

      {/* Header: pos label + name */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 2px" }}>
        <span style={{ fontSize: 9, color: isP1 && serve === "A" ? "#3b82f6" : "#2d5a7a", fontWeight: 700 }}>P{pos}{canServeBtns ? " 🏐" : ""}</span>
        <span style={{ fontSize: 8, color: "#4d7fa8", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: "70%", textAlign: "right" }}>{playerName}</span>
      </div>

      {/* Jersey number */}
      <div style={{ textAlign: "center", lineHeight: 1 }}>
        <span style={{ fontSize: isP1 ? 20 : 17, fontWeight: 900, fontFamily: "monospace", color: isLib ? "#f59e0b" : "#e2e8f0" }}>
          {isLib ? "L" : `#${jersey}`}
        </span>
      </div>

      {!tapMode && (
        <>
          {/* Attack + Error */}
          <div style={{ display: "flex", gap: 2 }}>
            <ABT onClick={stop(onAttack)} bg="linear-gradient(135deg,#1e40af,#1d4ed8)">⚡ Punto</ABT>
            <ABT onClick={stop(onError)} bg="linear-gradient(135deg,#9a3412,#c2410c)">❌ Err.</ABT>
          </div>

          {/* P1 serve buttons */}
          {canServeBtns && (
            <div style={{ display: "flex", gap: 2 }}>
              <ABT onClick={stop(onAce)} bg="linear-gradient(135deg,#14532d,#15803d)">🏐 Ace</ABT>
              <ABT onClick={stop(onServeError)} bg="linear-gradient(135deg,#7f1d1d,#991b1b)">💥 E.Srv</ABT>
            </div>
          )}

          {/* Generic error — only P1, below serve buttons */}
          {isP1 && (
            <button onClick={stop(onGenericError)} style={{
              background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: 5,
              color: "#ef4444", fontWeight: 700, fontSize: 9, padding: "4px 2px",
              cursor: "pointer", textAlign: "center", width: "100%",
            }}>⚠️ Err. Squadra</button>
          )}
        </>
      )}

      {/* Tap overlay */}
      {tapMode && (selected || isCorrectSrc) && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff18", borderRadius: 6 }}>
          <div style={{ fontSize: 22, color: selected ? "#60a5fa" : "#a855f7" }}>{selected ? "✓" : "→"}</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function VolleyballApp() {

  // ── Auth
  const [authed, setAuthed] = useState(() => LS.get("vb_authed", false));
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr,  setLoginErr]  = useState("");

  // ── Phase
  const [fase, setFase] = useState("home");

  // ── Persistent data
  const [teams,        setTeams]        = useState(() => LS.get("vb_teams", []));
  const [savedMatches, setSavedMatches] = useState(() => LS.get("vb_matches", []));
  useEffect(() => LS.set("vb_teams",   teams),        [teams]);
  useEffect(() => LS.set("vb_matches", savedMatches), [savedMatches]);

  // ── Team / match meta
  const [currentTeam,  setCurrentTeam]  = useState(null);
  const [editRoster,   setEditRoster]   = useState([]);
  const [opponentName, setOpponentName] = useState("");
  const [matchDate,    setMatchDate]    = useState(todayStr());
  const [homeAway,     setHomeAway]     = useState("home");

  // ── Team edit form
  const [rJersey, setRJersey] = useState("");
  const [rName,   setRName]   = useState("");
  const [rRole,   setRRole]   = useState(ROSTER_ROLES[0]);
  const [rErr,    setRErr]    = useState("");
  const [saveTeamModal, setSaveTeamModal] = useState(false);
  const [newTeamName,   setNewTeamName]   = useState("");
  const rJRef = useRef(null);

  // ── Match over (lifted from IIFE to avoid hook-rule violation)
  const [matchSaved,    setMatchSaved]    = useState(false);
  const [matchSavedRec, setMatchSavedRec] = useState(null);

  // ── Match state
  const [setN,       setSetN]       = useState(1);
  const [setVinti,   setSetVinti]   = useState({ A: 0, B: 0 });
  const [score,      setScore]      = useState({ A: 0, B: 0 });
  const [serve,      setServe]      = useState("A");
  const [endWinner,  setEndWinner]  = useState(null);
  const [rot,        setRot]        = useState([]);
  const [sp,         setSP]         = useState(1);
  const [prevSnap,   setPrevSnap]   = useState(null);
  const [flashTeam,  setFlashTeam]  = useState(null);
  const [rotAnim,    setRotAnim]    = useState(false);
  const flashT = useRef(null);
  const rotT   = useRef(null);

  // ── Libero
  const activeRoster = currentTeam?.roster ?? [];
  const liberoJersey = activeRoster.find(r => r.role === "Libero")?.jersey ?? null;
  const isCentrale   = j => activeRoster.find(r => r.jersey === j)?.role === "Centrale";
  const [liberoOnField,   setLiberoOnField]   = useState(false);
  const [liberoReplacing, setLiberoReplacing] = useState(null);

  // ── Setup
  const [setupStep,    setSetupStep]    = useState("setter");
  const [setupSP,      setSetupSP]      = useState(null);
  const [setupJerseys, setSetupJerseys] = useState([]);
  const [setupServe,   setSetupServe]   = useState("A");

  // ── Substitution
  const [subMode,      setSubMode]      = useState(false);
  const [subSrcPos,    setSubSrcPos]    = useState(null);
  const [subBenchOpen, setSubBenchOpen] = useState(false);
  const [subErr2,      setSubErr2]      = useState("");
  const [subs,         setSubs]         = useState([]);
  const [setLineups,   setSetLineups]   = useState([]);

  // ── Correct rotation
  const [correctMode,   setCorrectMode]   = useState(false);
  const [correctSrcPos, setCorrectSrcPos] = useState(null);

  // ── Serve tracking
  const [serveCounts,      setServeCounts]      = useState({});
  const [serveCountsBySet, setServeCountsBySet] = useState({});

  // ── Stats
  const [showStats, setShowStats] = useState(false);
  const [statsTab,  setStatsTab]  = useState("current");

  // ── Log
  const [log, setLog] = useState([]);

  // ── Results
  const [detailMatch, setDetailMatch] = useState(null);
  const [detailTab,   setDetailTab]   = useState("overview");

  // ── AUTO-SAVE: build snapshot of in-progress game and persist every point
  const buildGameSnapshot = useCallback(() => ({
    fase, setN, setVinti, score, serve, rot, sp,
    liberoOnField, liberoReplacing, log, subs, setLineups,
    serveCounts, serveCountsBySet, endWinner,
    currentTeamId: currentTeam?.id,
    opponentName, matchDate, homeAway,
  }), [fase, setN, setVinti, score, serve, rot, sp, liberoOnField, liberoReplacing, log, subs, setLineups, serveCounts, serveCountsBySet, endWinner, currentTeam, opponentName, matchDate, homeAway]);

  // Save snapshot whenever log changes (= after every point)
  useEffect(() => {
    if (fase === "gioco" && log.length > 0) {
      LS.set("vb_game_snap", buildGameSnapshot());
    }
  }, [log, fase]);

  // On mount: check for interrupted game
  const [resumePrompt, setResumePrompt] = useState(() => {
    const snap = LS.get("vb_game_snap", null);
    return snap && snap.fase === "gioco" && snap.log?.length > 0 ? snap : null;
  });

  const handleResumeGame = () => {
    const snap = resumePrompt;
    const team = teams.find(t => t.id === snap.currentTeamId) ?? null;
    setCurrentTeam(team);
    setOpponentName(snap.opponentName ?? "");
    setMatchDate(snap.matchDate ?? todayStr());
    setHomeAway(snap.homeAway ?? "home");
    setSetN(snap.setN); setSetVinti(snap.setVinti); setScore(snap.score);
    setServe(snap.serve); setRot(snap.rot); setSP(snap.sp);
    setLiberoOnField(snap.liberoOnField ?? false); setLiberoReplacing(snap.liberoReplacing ?? null);
    setLog(snap.log); setSubs(snap.subs ?? []); setSetLineups(snap.setLineups ?? []);
    setServeCounts(snap.serveCounts ?? {}); setServeCountsBySet(snap.serveCountsBySet ?? {});
    setEndWinner(snap.endWinner ?? null);
    setFase("gioco"); setResumePrompt(null);
  };

  const handleDiscardResume = () => { LS.del("vb_game_snap"); setResumePrompt(null); };

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const handleLogin = () => {
    if (loginUser.trim() === APP_USER && loginPass === APP_PASS) { setAuthed(true); LS.set("vb_authed", true); }
    else setLoginErr("Credenziali errate");
  };
  const handleLogout = () => { setAuthed(false); LS.set("vb_authed", false); setFase("home"); };

  // ── ROSTER ────────────────────────────────────────────────────────────────
  const handleAddPlayer = () => {
    const j = rJersey.trim(), n = rName.trim();
    if (!j) { setRErr("Numero maglia obbligatorio"); return; }
    if (!n) { setRErr("Nome obbligatorio"); return; }
    if (editRoster.find(p => p.jersey === j)) { setRErr(`Maglia #${j} già presente`); return; }
    setEditRoster(prev => [...prev, { jersey: j, name: n, role: rRole }]);
    setRJersey(""); setRName(""); setRRole(ROSTER_ROLES[0]); setRErr("");
    setTimeout(() => rJRef.current?.focus(), 50);
  };
  const handleSelectTeam = t => { setCurrentTeam(t); setEditRoster([...t.roster]); setFase("teamEdit"); };
  const handleNewTeam    = () => { setCurrentTeam(null); setEditRoster([]); setFase("teamEdit"); };
  const handleTeamEditDone = () => {
    if (editRoster.length < 6) { setRErr("Servono almeno 6 giocatrici"); return; }
    setSaveTeamModal(true); setNewTeamName("");
  };
  const handleSaveTeamOverwrite = () => {
    const updated = { ...currentTeam, roster: editRoster };
    setTeams(prev => prev.map(t => t.id === currentTeam.id ? updated : t));
    setCurrentTeam(updated); setSaveTeamModal(false); setFase("matchMeta");
  };
  const handleSaveTeamNew = () => {
    if (!newTeamName.trim()) return;
    const t = { id: uid(), name: newTeamName.trim(), roster: editRoster };
    setTeams(prev => [...prev, t]); setCurrentTeam(t); setSaveTeamModal(false); setFase("matchMeta");
  };

  // ── MATCH META ────────────────────────────────────────────────────────────
  const handleStartMatchSetup = () => {
    if (!opponentName.trim()) return;
    setSetupStep("setter"); setSetupSP(null); setSetupJerseys([]);
    setSetN(1); setSetVinti({ A: 0, B: 0 }); setScore({ A: 0, B: 0 }); setServe("A");
    setLog([]); setSubs([]); setSetLineups([]); setServeCounts({}); setServeCountsBySet({});
    setLiberoOnField(false); setLiberoReplacing(null); setPrevSnap(null);
    setMatchSaved(false); setMatchSavedRec(null);
    setFase("setup");
  };

  // ── SETUP ─────────────────────────────────────────────────────────────────
  const posOrdinati      = setupSP ? posOrder(setupSP) : [];
  const curPos           = posOrdinati[setupJerseys.length];
  const availPlayers     = activeRoster.filter(p => !setupJerseys.includes(p.jersey) && p.jersey !== liberoJersey);
  const buildPreviewRot  = () => { const r = new Array(6).fill(""); posOrdinati.forEach((p, i) => { if (i < setupJerseys.length) r[p-1] = setupJerseys[i]; }); return r; };

  const handlePickSetupPlayer = jersey => {
    const next = [...setupJerseys, jersey];
    setSetupJerseys(next);
    if (next.length >= 6) setSetupStep("serve");
  };
  const handleSetupBack = () => {
    if (setupStep === "pickPlayers") { if (!setupJerseys.length) { setSetupStep("setter"); setSetupSP(null); } else setSetupJerseys(setupJerseys.slice(0,-1)); }
    else if (setupStep === "serve") { setSetupStep("pickPlayers"); setSetupJerseys(setupJerseys.slice(0,-1)); }
  };
  const handleStartSet = () => {
    const newRot = new Array(6).fill("");
    posOrder(setupSP).forEach((p, i) => { newRot[p-1] = setupJerseys[i]; });
    setRot(newRot); setSP(setupSP); setScore({ A: 0, B: 0 }); setServe(setupServe);
    setPrevSnap(null); setLiberoOnField(false); setLiberoReplacing(null);
    setSetLineups(prev => [...prev, { setN, rot: newRot, sp: setupSP }]);
    setFase("gioco");
  };

  // ── GAME ──────────────────────────────────────────────────────────────────
  const triggerFlash   = t  => { clearTimeout(flashT.current); setFlashTeam(t); flashT.current = setTimeout(() => setFlashTeam(null), 300); };
  const triggerRotAnim = () => { clearTimeout(rotT.current); setRotAnim(true); rotT.current = setTimeout(() => setRotAnim(false), 600); };

  const trackServe = (currentRot, currentServe, sn) => {
    if (currentServe !== "A") return;
    const server = getServer(currentRot);
    setServeCounts(prev => ({ ...prev, [server]: (prev[server] || 0) + 1 }));
    setServeCountsBySet(prev => ({ ...prev, [sn]: { ...(prev[sn] || {}), [server]: ((prev[sn] || {})[server] || 0) + 1 } }));
  };

  const applyPoint = (teamPoint, tipo, maglia) => {
    const snap = { rot:[...rot], sp, serve, score:{...score}, log:[...log], liberoOnField, liberoReplacing, serveCounts:{...serveCounts}, serveCountsBySet: JSON.parse(JSON.stringify(serveCountsBySet)) };
    setPrevSnap(snap);
    const ns = { A: score.A, B: score.B }; ns[teamPoint]++; triggerFlash(teamPoint);
    let nr = [...rot], nsp = sp, nsrv = serve;
    if (teamPoint === "A" && serve === "B") { nr = rotaA(rot); nsp = nextSP(sp); nsrv = "A"; triggerRotAnim(); }
    else if (teamPoint === "B" && serve === "A") { nsrv = "B"; }

    // Libero
    let libOn = liberoOnField, libRep = liberoReplacing;
    if (liberoJersey) {
      if (nsrv === "B" && serve === "A") {
        if (isCentrale(nr[0])) { libRep = nr[0]; nr[0] = liberoJersey; libOn = true; }
      } else if (nsrv === "A" && serve === "B") {
        if (isCentrale(nr[0]) && libOn) { const li = nr.indexOf(liberoJersey); if (li !== -1) nr[li] = libRep; libOn = false; libRep = null; }
      }
    }

    const tipoLabel = tipo === "attacco" ? "Attacco vincente" : tipo === "battuta" ? "Ace" : tipo === "errore_battuta" ? "Errore in battuta" : "Errore";
    const entry = {
      Set: setN, "N° Punto": log.filter(l => l.Set === setN).length + 1,
      "Squadra punto": teamPoint, "Tipo azione": tipoLabel,
      "Maglia responsabile": maglia ?? "",
      "Errore in battuta": tipo === "errore_battuta" ? "Sì" : tipo === "battuta" ? "No" : "",
      "Punti A": ns.A, "Punti B": ns.B, "Chi batteva": nsrv,
    };
    setLog(prev => [...prev, entry]);
    setRot(nr); setSP(nsp); setServe(nsrv); setScore(ns);
    setLiberoOnField(libOn); setLiberoReplacing(libRep);

    if (checkWin(ns.A, ns.B, setN)) {
      const winner = ns.A > ns.B ? "A" : "B"; setEndWinner(winner);
      const nSV = { A: setVinti.A, B: setVinti.B }; nSV[winner]++;
      setSetVinti(nSV);
      // Clear autosave when match ends
      LS.del("vb_game_snap");
      setFase(nSV[winner] >= 3 ? "matchOver" : "setOver");
    }
  };

  const doPoint = (teamPoint, tipo, maglia) => { trackServe(rot, serve, setN); applyPoint(teamPoint, tipo, maglia); };

  const handlePlayerAttack  = j  => doPoint("A", "attacco", j);
  const handlePlayerError   = j  => doPoint("B", "errore",  j);
  const handleAce           = () => doPoint("A", "battuta",        getServer(rot));
  const handleServeError    = () => doPoint("B", "errore_battuta", getServer(rot));
  const handleGenericError  = () => doPoint("B", "errore", null);
  const handleGuestAttack   = () => doPoint("B", "attacco", null);
  const handleGuestServe    = () => { if (serve !== "B") return; doPoint("B", "battuta", null); };
  const handleGuestError    = () => doPoint("A", "errore", null);

  const handleUndo = () => {
    if (!prevSnap) return;
    setRot(prevSnap.rot); setSP(prevSnap.sp); setServe(prevSnap.serve); setScore(prevSnap.score); setLog(prevSnap.log);
    setLiberoOnField(prevSnap.liberoOnField ?? false); setLiberoReplacing(prevSnap.liberoReplacing ?? null);
    setServeCounts(prevSnap.serveCounts ?? {}); setServeCountsBySet(prevSnap.serveCountsBySet ?? {});
    setPrevSnap(null);
  };

  // ── SUBSTITUTION ──────────────────────────────────────────────────────────
  const benchPlayers  = activeRoster.filter(p => !rot.includes(p.jersey) && p.jersey !== liberoJersey);
  const handleSubTapPos = pos => { setSubSrcPos(pos); setSubBenchOpen(true); setSubErr2(""); };
  const handleSubPickBench = jersey => {
    if (rot.includes(jersey)) { setSubErr2(`#${jersey} è già in campo!`); return; }
    const outJ = rot[subSrcPos - 1];
    const newRot = [...rot]; newRot[subSrcPos - 1] = jersey;
    setRot(newRot);
    setSubs(prev => [...prev, { set: setN, scoreA: score.A, scoreB: score.B, out: outJ, in: jersey, position: subSrcPos, ruolo: getRuoloS(subSrcPos, sp) }]);
    setSubMode(false); setSubSrcPos(null); setSubBenchOpen(false); setSubErr2("");
  };
  const cancelSub = () => { setSubMode(false); setSubSrcPos(null); setSubBenchOpen(false); setSubErr2(""); };

  // ── CORRECT ROTATION ──────────────────────────────────────────────────────
  const handleCorrectTapPos = pos => {
    if (!correctSrcPos) { setCorrectSrcPos(pos); }
    else {
      if (pos !== correctSrcPos) { const nr = [...rot]; const tmp = nr[correctSrcPos-1]; nr[correctSrcPos-1] = nr[pos-1]; nr[pos-1] = tmp; setRot(nr); }
      setCorrectMode(false); setCorrectSrcPos(null);
    }
  };

  // ── STATS ─────────────────────────────────────────────────────────────────
  const computeStats = setNum => {
    const isAll = setNum === "all";
    const sl = isAll ? log : log.filter(l => l.Set === setNum);
    const sc = isAll ? serveCounts : (serveCountsBySet[setNum] || {});
    const st = {};
    const ensure = j => { if (!st[j]) st[j] = { punti: 0, ace: 0, attacchi: 0, errori: 0, erroriServ: 0, battute: 0 }; };
    rot.forEach(j => j && ensure(j));
    setLineups.forEach(s => s.rot.forEach(j => j && ensure(j)));
    subs.forEach(s => { ensure(s.in); ensure(s.out); });
    Object.entries(sc).forEach(([j, c]) => { ensure(j); st[j].battute = c; });
    sl.forEach(e => {
      const j = e["Maglia responsabile"]; if (!j) return; ensure(j);
      if (e["Squadra punto"] === "A") { st[j].punti++; if (e["Tipo azione"] === "Ace") st[j].ace++; if (e["Tipo azione"] === "Attacco vincente") st[j].attacchi++; }
      else if (e["Tipo azione"] === "Errore in battuta") { st[j].errori++; st[j].erroriServ++; }
      else if (e["Tipo azione"] === "Errore") st[j].errori++;
    });
    return st;
  };

  const availableSets = [...new Set(log.map(l => l.Set))].sort((a, b) => a - b);

  // ── TRANSITIONS ───────────────────────────────────────────────────────────
  const handleNextSet = () => {
    setSetN(prev => prev + 1); setSetupStep("setter"); setSetupSP(null);
    setSetupJerseys([]); setSetupServe("A"); setPrevSnap(null); setFase("setup");
  };

  // ── MATCH RECORD ──────────────────────────────────────────────────────────
  const matchLabel = m => {
    const h = m.homeAway === "home";
    const a = h ? m.teamName : m.opponentName, b = h ? m.opponentName : m.teamName;
    const sa = h ? m.setsA : m.setsB, sb = h ? m.setsB : m.setsA;
    return `${m.date}-${a} Vs ${b} – (${sa}-${sb})`;
  };
  const buildMatchRecord = () => ({
    id: uid(), date: matchDate, teamId: currentTeam?.id, teamName: currentTeam?.name ?? "Squadra A",
    opponentName: opponentName || "GUEST", homeAway, setsA: setVinti.A, setsB: setVinti.B,
    log: [...log], subs: [...subs], setLineups: [...setLineups],
    serveCounts: { ...serveCounts }, serveCountsBySet: JSON.parse(JSON.stringify(serveCountsBySet)),
    roster: [...activeRoster], stats: computeStats("all"),
  });
  const handleSaveMatch = () => {
    const rec = buildMatchRecord();
    setSavedMatches(prev => [...prev, rec]);
    setMatchSaved(true); setMatchSavedRec(rec);
    LS.del("vb_game_snap");
  };
  const handleNewMatch = () => {
    setFase("home"); setSetN(1); setSetVinti({ A: 0, B: 0 }); setScore({ A: 0, B: 0 }); setLog([]);
    setSubs([]); setSetLineups([]); setServeCounts({}); setServeCountsBySet({});
    setEndWinner(null); setPrevSnap(null); setServe("A");
    setLiberoOnField(false); setLiberoReplacing(null);
    setOpponentName(""); setMatchDate(todayStr()); setHomeAway("home");
    setMatchSaved(false); setMatchSavedRec(null);
    LS.del("vb_game_snap");
  };

  // ── EXCEL ─────────────────────────────────────────────────────────────────
  const exportMatchToExcel = m => {
    const { log: ml, subs: ms, setLineups: msl, serveCounts: msc, serveCountsBySet: mscbs, roster: mr } = m;
    const wb = XLSX.utils.book_new();
    const uSets = [...new Set(ml.map(l => l.Set))].sort((a, b) => a - b);
    const aoa1 = [[matchLabel(m)], [`Data: 20${m.date.slice(0,2)}-${m.date.slice(2,4)}-${m.date.slice(4,6)}  |  ${m.homeAway === "home" ? "Casa" : "Trasferta"}`], []];
    uSets.forEach(sn => {
      aoa1.push([`◆ SET ${sn}`, "", "", "", "", "", "", ""]);
      aoa1.push(["N°", "Squadra", "Tipo", "Maglia", "Nome", "Err.Batt", "Pt A", "Pt B"]);
      ml.filter(l => l.Set === sn).forEach(p => {
        const pl = mr.find(r => r.jersey === p["Maglia responsabile"]);
        aoa1.push([p["N° Punto"], `Sq. ${p["Squadra punto"]}`, p["Tipo azione"], p["Maglia responsabile"] ? `#${p["Maglia responsabile"]}` : "—", pl?.name ?? "", p["Errore in battuta"] || "", p["Punti A"], p["Punti B"]]);
      });
      const last = ml.filter(l => l.Set === sn).slice(-1)[0];
      if (last) aoa1.push([`➤ Vince ${last["Punti A"] > last["Punti B"] ? m.teamName : m.opponentName}  (${last["Punti A"]}:${last["Punti B"]})`, "", "", "", "", "", "", ""]);
      aoa1.push([]);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(aoa1); ws1["!cols"] = [{wch:6},{wch:12},{wch:20},{wch:8},{wch:16},{wch:10},{wch:6},{wch:6}];
    XLSX.utils.book_append_sheet(wb, ws1, "Andamento");
    const allJ = [...new Set([...msl.flatMap(sl => sl.rot), ...ms.flatMap(s => [s.in, s.out])])].filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));
    const hdr = ["Maglia","Nome","Ruolo",...uSets.flatMap(s=>[`S${s} Pt`,`S${s} Ace`,`S${s} Err`,`S${s} Batt`,`S${s} %Ace`,`S${s} %Err`]),"Tot Pt","Tot Ace","Tot Err","Tot Batt","Tot %Ace","Tot %Err"];
    const rows = allJ.map(j => {
      const pl = mr.find(r => r.jersey === j) || { name: "", role: "" };
      const row = [`#${j}`, pl.name, pl.role]; let tp=0,ta=0,te=0,tb=0;
      uSets.forEach(sn => {
        const batt = (mscbs[sn]||{})[j]||0; let pt=0,ace=0,err=0;
        ml.filter(l=>l.Set===sn).forEach(e=>{ if(e["Maglia responsabile"]!==j)return; if(e["Squadra punto"]==="A"){pt++;if(e["Tipo azione"]==="Ace")ace++;}else if(e["Tipo azione"]==="Errore in battuta"||e["Tipo azione"]==="Errore")err++; });
        row.push(pt,ace,err,batt,batt>0?`${Math.round(ace/batt*100)}%`:"—",batt>0?`${Math.round(err/batt*100)}%`:"—");
        tp+=pt;ta+=ace;te+=err;tb+=batt;
      });
      row.push(tp,ta,te,tb,tb>0?`${Math.round(ta/tb*100)}%`:"—",tb>0?`${Math.round(te/tb*100)}%`:"—");
      return row;
    });
    const ws2 = XLSX.utils.aoa_to_sheet([hdr,...rows]); ws2["!cols"]=[{wch:8},{wch:16},{wch:14},...Array(hdr.length-3).fill({wch:9})];
    XLSX.utils.book_append_sheet(wb, ws2, "Statistiche");
    XLSX.writeFile(wb, `${matchLabel(m).replace(/[^a-zA-Z0-9\-_]/g,"_")}.xlsx`);
  };
  const handleExport = () => exportMatchToExcel(buildMatchRecord());

  // ── STYLES ────────────────────────────────────────────────────────────────
  const S = {
    root:    { minHeight: "100dvh", background: "#060e1a", color: "#e2e8f0", fontFamily: "'Segoe UI',system-ui,sans-serif" },
    card:    { background: "#0d1f35", borderRadius: 16, padding: 16, boxShadow: "0 8px 40px #00000088" },
    label:   { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#4d7fa8", textTransform: "uppercase" },
    tag:     c => ({ display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c+"22", color: c, border: `1px solid ${c}44` }),
    inp:     { width: "100%", background: "#0a1929", border: "2px solid #1e3a5f", borderRadius: 12, padding: "11px 13px", color: "#e2e8f0", fontSize: 16, outline: "none", fontFamily: "monospace", fontWeight: 700, boxSizing: "border-box" },
    btn:     (bg, col="#fff") => ({ width: "100%", padding: 13, borderRadius: 13, fontSize: 15, fontWeight: 900, background: bg, border: "none", color: col, cursor: "pointer" }),
    overlay: { position: "fixed", inset: 0, background: "#000000bb", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 14 },
  };

  const teamALabel = currentTeam?.name ?? "Squadra A";
  const teamBLabel = opponentName || "GUEST";
  const tapMode    = subMode ? "sub" : correctMode ? "correct" : null;
  const handlePosTap = pos => { if (subMode) handleSubTapPos(pos); else if (correctMode) handleCorrectTapPos(pos); };

  // ══════════════════════════════════════════════════════════════════════════
  // ── LOGIN
  if (!authed) return (
    <div style={{ ...S.root, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ ...S.card, width: "100%", maxWidth: 320, animation: "fadeIn 0.4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>🏐</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#60a5fa" }}>Stella Azzurra</div>
        </div>
        <div style={{ ...S.label, marginBottom: 5 }}>Utente</div>
        <input type="text" value={loginUser} onChange={e => { setLoginUser(e.target.value); setLoginErr(""); }} onKeyDown={e => e.key==="Enter"&&document.getElementById("pI")?.focus()} placeholder="Username" style={{ ...S.inp, marginBottom: 10 }} />
        <div style={{ ...S.label, marginBottom: 5 }}>Password</div>
        <input id="pI" type="password" value={loginPass} onChange={e => { setLoginPass(e.target.value); setLoginErr(""); }} onKeyDown={e => e.key==="Enter"&&handleLogin()} placeholder="Password" style={{ ...S.inp, marginBottom: loginErr ? 7 : 14 }} />
        {loginErr && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{loginErr}</div>}
        <button onClick={handleLogin} style={S.btn("linear-gradient(135deg,#1d4ed8,#1e40af)")}>Accedi →</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.root}>
      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rotGlow{0%{box-shadow:0 0 0 #60a5fa}50%{box-shadow:0 0 16px #60a5fa88}100%{box-shadow:0 0 0 #60a5fa}}
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      {/* ── RESUME PROMPT ─────────────────────────────────────────────────────── */}
      {resumePrompt && fase === "home" && (
        <div style={S.overlay}>
          <div style={{ ...S.card, width: "100%", maxWidth: 310, border: "1px solid #16a34a44", animation: "fadeIn 0.2s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>⚡</div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>Partita in corso!</div>
              <div style={{ fontSize: 12, color: "#4d7fa8", marginTop: 5 }}>
                Trovata una partita salvata automaticamente.<br />
                Vuoi riprendere da dove eri rimasto?
              </div>
              <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 14, color: "#22c55e" }}>
                {resumePrompt.score?.A ?? 0} : {resumePrompt.score?.B ?? 0} — Set {resumePrompt.setN}
              </div>
            </div>
            <button onClick={handleResumeGame} style={{ ...S.btn("linear-gradient(135deg,#16a34a,#15803d)"), marginBottom: 8 }}>▶ Riprendi partita</button>
            <button onClick={handleDiscardResume} style={{ width: "100%", padding: 10, background: "none", border: "1px solid #3a1f0d", borderRadius: 11, color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✕ Scarta e ricomincia</button>
          </div>
        </div>
      )}

      {/* ═══ HOME ═══ */}
      {fase === "home" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 340 }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 44, marginBottom: 6 }}>🏐</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#60a5fa" }}>Stella Azzurra</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={() => setFase("results")} style={{ ...S.card, border: "1px solid #1e3a5f", cursor: "pointer", textAlign: "center", padding: 18 }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 900 }}>Risultati precedenti</div>
                <div style={{ fontSize: 11, color: "#4d7fa8", marginTop: 3 }}>{savedMatches.length} partite salvate</div>
              </button>
              <button onClick={() => setFase(teams.length > 0 ? "teamSelect" : "teamEdit")} style={{ ...S.card, border: "1px solid #16a34a44", cursor: "pointer", textAlign: "center", padding: 18, background: "#0d2218" }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>▶️</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#22c55e" }}>Gioca una partita</div>
              </button>
            </div>
            <button onClick={handleLogout} style={{ width: "100%", marginTop: 16, padding: 10, background: "none", border: "none", color: "#2d5a7a", cursor: "pointer", fontSize: 12 }}>Esci ↗</button>
          </div>
        </div>
      )}

      {/* ═══ TEAM SELECT ═══ */}
      {fase === "teamSelect" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 16, minHeight: "100dvh" }}>
          <div style={{ width: "100%", maxWidth: 380, paddingTop: 14 }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#60a5fa" }}>Seleziona squadra</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {teams.map(t => (
                <button key={t.id} onClick={() => handleSelectTeam(t)} style={{ ...S.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
                  <div style={{ fontSize: 20 }}>👕</div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontWeight: 900, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#4d7fa8" }}>{t.roster.length} giocatrici</div>
                  </div>
                  <div style={{ fontSize: 18, color: "#1e3a5f" }}>›</div>
                </button>
              ))}
            </div>
            <button onClick={handleNewTeam} style={S.btn("linear-gradient(135deg,#1d4ed8,#1e40af)")}>＋ Nuova squadra</button>
            <button onClick={() => setFase("home")} style={{ width: "100%", marginTop: 8, padding: 10, background: "none", border: "none", color: "#4d7fa8", cursor: "pointer", fontSize: 13 }}>← Indietro</button>
          </div>
        </div>
      )}

      {/* ═══ TEAM EDIT ═══ */}
      {fase === "teamEdit" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 16, paddingBottom: 32, minHeight: "100dvh" }}>
          <div style={{ width: "100%", maxWidth: 400, paddingTop: 12 }}>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#60a5fa" }}>{currentTeam ? `Modifica: ${currentTeam.name}` : "Nuova squadra"}</div>
            </div>
            <div style={{ ...S.card, marginBottom: 10 }}>
              <div style={{ ...S.label, marginBottom: 7 }}>Aggiungi giocatrice</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input ref={rJRef} type="number" inputMode="numeric" value={rJersey} onChange={e => { setRJersey(e.target.value); setRErr(""); }} onKeyDown={e => e.key==="Enter"&&document.getElementById("rNI")?.focus()} placeholder="N°" style={{ ...S.inp, width: 66, textAlign: "center", padding: "10px 5px", flex: "0 0 66px" }} />
                <input id="rNI" type="text" value={rName} onChange={e => { setRName(e.target.value); setRErr(""); }} onKeyDown={e => e.key==="Enter"&&handleAddPlayer()} placeholder="Nome cognome" style={{ ...S.inp, fontSize: 13, flex: 1 }} />
              </div>
              <select value={rRole} onChange={e => setRRole(e.target.value)} style={{ ...S.inp, fontSize: 12, marginBottom: 6, appearance: "none" }}>
                {ROSTER_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
              {rErr && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 5, textAlign: "center" }}>{rErr}</div>}
              <button onClick={handleAddPlayer} style={S.btn("#1e3a5f", "#93c5fd")}>＋ Aggiungi</button>
            </div>
            {editRoster.length > 0 && (
              <div style={{ ...S.card, marginBottom: 10 }}>
                <div style={{ ...S.label, marginBottom: 7 }}>Distinta ({editRoster.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {editRoster.map(p => (
                    <div key={p.jersey} style={{ display: "flex", alignItems: "center", gap: 7, background: "#060e1a", borderRadius: 9, padding: "6px 10px", border: "1px solid #1e3a5f" }}>
                      <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 14, color: p.role === "Libero" ? "#f59e0b" : "#60a5fa", width: 34 }}>#{p.jersey}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: p.role === "Libero" ? "#92400e" : "#4d7fa8" }}>{p.role}</div>
                      </div>
                      <button onClick={() => setEditRoster(prev => prev.filter(x => x.jersey !== p.jersey))} style={{ background: "none", border: "1px solid #3a1f0d", borderRadius: 7, padding: "3px 7px", color: "#ef4444", cursor: "pointer", fontSize: 11 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {editRoster.length >= 6 && <button onClick={handleTeamEditDone} style={S.btn("linear-gradient(135deg,#16a34a,#15803d)")}>✓ Conferma Distinta</button>}
            <button onClick={() => setFase(teams.length > 0 ? "teamSelect" : "home")} style={{ width: "100%", marginTop: 8, padding: 10, background: "none", border: "none", color: "#4d7fa8", cursor: "pointer", fontSize: 13 }}>← Indietro</button>
          </div>
        </div>
      )}

      {/* ═══ MATCH META ═══ */}
      {fase === "matchMeta" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 360 }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#60a5fa" }}>{currentTeam?.name}</div>
              <div style={{ fontSize: 12, color: "#4d7fa8", marginTop: 3 }}>Dettagli partita</div>
            </div>
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 5 }}>Squadra avversaria</div>
              <input type="text" value={opponentName} onChange={e => setOpponentName(e.target.value)} placeholder="Es. Canonica, Cassano..." style={{ ...S.inp, marginBottom: 12, textAlign: "center" }} />
              <div style={{ ...S.label, marginBottom: 5 }}>Data (AAMMGG)</div>
              <input type="text" value={matchDate} onChange={e => setMatchDate(e.target.value)} placeholder="es. 260321" maxLength={6} style={{ ...S.inp, marginBottom: 12, textAlign: "center", letterSpacing: 3 }} />
              <div style={{ ...S.label, marginBottom: 7 }}>Casa / Trasferta</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[["home","🏠 Casa"],["away","✈️ Trasferta"]].map(([v,l]) => (
                  <button key={v} onClick={() => setHomeAway(v)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", background: homeAway===v?"#1d4ed8":"#1e3a5f", color: homeAway===v?"#fff":"#93c5fd" }}>{l}</button>
                ))}
              </div>
              <button onClick={handleStartMatchSetup} disabled={!opponentName.trim()} style={{ ...S.btn("linear-gradient(135deg,#16a34a,#15803d)"), opacity: opponentName.trim()?1:0.4 }}>▶  Seleziona formazione</button>
              <button onClick={() => setFase("teamEdit")} style={{ width: "100%", marginTop: 8, padding: 10, background: "none", border: "none", color: "#4d7fa8", cursor: "pointer", fontSize: 13 }}>← Modifica distinta</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SETUP ═══ */}
      {fase === "setup" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 14 }}>
          <div style={{ width: "100%", maxWidth: 390 }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Set <span style={{ color: "#60a5fa" }}>{setN}</span></div>
              <div style={{ fontSize: 11, color: "#4d7fa8" }}>{teamALabel} vs {teamBLabel}</div>
            </div>
            <div style={S.card}>
              {setupStep === "setter" && (
                <>
                  <div style={{ textAlign: "center", marginBottom: 10 }}>
                    <div style={S.label}>Formazione {teamALabel}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "#93c5fd" }}>Dove si trova il <span style={{ color: "#22c55e" }}>Palleggiatore</span>?</div>
                  </div>
                  <CampoSetup rot={new Array(6).fill("")} sp={null} interactive onSelect={pos => { setSetupSP(pos); setSetupJerseys([]); setSetupStep("pickPlayers"); }} roster={activeRoster} />
                  {liberoJersey && <div style={{ marginTop: 7, padding: "5px 10px", background: "#1a1000", borderRadius: 8, textAlign: "center", fontSize: 11 }}>🟡 Libero <span style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: 700 }}>#{liberoJersey}</span> — entra auto</div>}
                </>
              )}
              {setupStep === "pickPlayers" && (
                <>
                  <div style={{ textAlign: "center", marginBottom: 7 }}>
                    <div style={S.label}>Posizione {setupJerseys.length + 1} di 6</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>Chi è in pos.<span style={{ color: "#60a5fa" }}> {curPos}</span>? <span style={{ fontSize: 11, color: "#fbbf24" }}>({getRuoloS(curPos, setupSP)})</span></div>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                    {[0,1,2,3,4,5].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < setupJerseys.length ? "#3b82f6" : i === setupJerseys.length ? "#1d4ed8" : "#1e3a5f" }} />)}
                  </div>
                  <div style={{ marginBottom: 8 }}><CampoSetup rot={buildPreviewRot()} sp={setupSP} highlight={curPos} roster={activeRoster} /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 7 }}>
                    {availPlayers.map(p => (
                      <button key={p.jersey} onClick={() => handlePickSetupPlayer(p.jersey)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 13px", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: 11, cursor: "pointer" }}>
                        <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 19, color: "#60a5fa", width: 40 }}>#{p.jersey}</div>
                        <div style={{ flex: 1, textAlign: "left" }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#4d7fa8" }}>{p.role}</div>
                        </div>
                        <div style={{ fontSize: 16, color: "#1e3a5f" }}>›</div>
                      </button>
                    ))}
                    {!availPlayers.length && <div style={{ textAlign: "center", color: "#4d7fa8", fontSize: 12, padding: 8 }}>Nessuna disponibile</div>}
                  </div>
                  <button onClick={handleSetupBack} style={{ width: "100%", padding: 9, borderRadius: 9, background: "none", border: "1px solid #1e3a5f", color: "#4d7fa8", cursor: "pointer", fontSize: 12 }}>← Indietro</button>
                </>
              )}
              {setupStep === "serve" && (
                <>
                  <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <div style={S.label}>Tutto pronto</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: "#93c5fd" }}>Chi batte per primo?</div>
                  </div>
                  <CampoSetup rot={buildPreviewRot()} sp={setupSP} roster={activeRoster} />
                  <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
                    {["A","B"].map(sq => (
                      <button key={sq} onClick={() => setSetupServe(sq)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, fontWeight: 700, fontSize: 13, textAlign: "center", cursor: "pointer", border: "none", background: sq==="A"?(setupServe===sq?"#1d4ed8":"#1e3a5f"):(setupServe===sq?"#c2410c":"#3a1f0d"), color: setupServe===sq?"#fff":sq==="A"?"#93c5fd":"#fdba74" }}>
                        <div style={{ fontSize: 16, marginBottom: 2 }}>🏐</div>{sq==="A"?teamALabel:teamBLabel}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleStartSet} style={S.btn("linear-gradient(135deg,#16a34a,#15803d)")}>▶  START SET {setN}</button>
                  <button onClick={handleSetupBack} style={{ width: "100%", marginTop: 6, padding: 9, background: "none", border: "none", color: "#4d7fa8", cursor: "pointer", fontSize: 12 }}>← Modifica</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ GAME ═══ */}
      {fase === "gioco" && (
        <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>

          {/* HEADER */}
          <div style={{ background: "#0a1929", borderBottom: "1px solid #1e3a5f", padding: "5px 12px", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <div style={{ fontSize: 9, color: "#4d7fa8", fontWeight: 700 }}>SET {setN} {setVinti.A > 0 || setVinti.B > 0 ? `(${setVinti.A}-${setVinti.B})` : ""}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={S.tag("#60a5fa")}>A:{setVinti.A}</span>
                <span style={S.tag("#fb923c")}>B:{setVinti.B}</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: serve==="A"?"#60a5fa":"#fb923c", padding: "2px 7px", borderRadius: 7, background: serve==="A"?"#1e3a5f44":"#3a1f0d44" }}>
                {serve==="A" ? <span>🏐 <span style={{ fontFamily: "monospace" }}>#{getServer(rot)}</span></span> : <span>Batte {teamBLabel}</span>}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
              <div style={{ fontSize: 14, opacity: serve==="A"?1:0.15, transition: "all 0.4s", filter: serve==="A"?"drop-shadow(0 0 5px #60a5fa)":"none" }}>🏐</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ScoreFlash score={score.A} team="A" flash={flashTeam==="A"} />
                <span style={{ fontSize: 22, color: "#1e3a5f", fontWeight: 900 }}>:</span>
                <ScoreFlash score={score.B} team="B" flash={flashTeam==="B"} />
              </div>
              <div style={{ fontSize: 14, opacity: serve==="B"?1:0.15, transition: "all 0.4s", filter: serve==="B"?"drop-shadow(0 0 5px #fb923c)":"none" }}>🏐</div>
            </div>
          </div>

          {/* 6 POSITION CARDS — 2 rows of 3 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 3, flex: 1, minHeight: 0, animation: rotAnim ? "rotGlow 0.6s ease" : "none" }}>
            {[...FRONT_ROW, ...BACK_ROW].map(pos => {
              const jersey = rot[pos - 1];
              const p = activeRoster.find(r => r.jersey === jersey) || { name: "", role: "" };
              const isLib = liberoOnField && jersey === liberoJersey;
              const isP1  = pos === 1;
              return (
                <PositionCard key={pos}
                  pos={pos} jersey={jersey} playerName={p.name}
                  isP1={isP1} isLib={isLib} serve={serve}
                  onAttack={() => handlePlayerAttack(jersey)}
                  onError={() => handlePlayerError(jersey)}
                  onAce={handleAce}
                  onServeError={handleServeError}
                  onGenericError={handleGenericError}
                  tapMode={!!tapMode}
                  selected={subMode && subSrcPos === pos}
                  isCorrectSrc={correctMode && correctSrcPos === pos}
                  onTap={handlePosTap}
                />
              );
            })}
          </div>

          {/* GUEST ROW */}
          <div style={{ display: "flex", gap: 3, padding: "3px", background: "#080800", borderTop: "1px solid #3a1f0d33", flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: "#f97316", fontWeight: 700, alignSelf: "center", minWidth: 36, textAlign: "center" }}>{teamBLabel.slice(0,6).toUpperCase()}</div>
            {[
              { label: "⚡ Attacco",       fn: handleGuestAttack, dis: false,        bg: "linear-gradient(135deg,#c2410c,#9a3412)" },
              { label: "🏐 Battuta",       fn: handleGuestServe,  dis: serve!=="B",  bg: "linear-gradient(135deg,#92400e,#78350f)" },
              { label: "❌ Errore → Pt A", fn: handleGuestError,  dis: false,        bg: "#1a0a0a" },
            ].map(({ label, fn, dis, bg }) => (
              <button key={label} onClick={dis ? undefined : fn} style={{
                flex: 1, padding: "6px 2px", borderRadius: 8, fontWeight: 700, fontSize: 10,
                border: "none", cursor: dis ? "not-allowed" : "pointer",
                background: dis ? "#0d0d0d" : bg, color: dis ? "#2a2a2a" : "#fff",
                opacity: dis ? 0.3 : 1, lineHeight: 1.3, textAlign: "center",
              }}>{label}</button>
            ))}
          </div>

          {/* BOTTOM BAR */}
          <div style={{ background: "#0a1929", borderTop: "1px solid #1e3a5f", padding: "5px 6px", flexShrink: 0 }}>
            {/* Mode banner */}
            {(subMode || correctMode) && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: subMode ? "#1a1500" : "#1a003a", border: `1px solid ${subMode?"#ca8a0444":"#7c3aed44"}`, borderRadius: 7, padding: "4px 9px", marginBottom: 5 }}>
                <div style={{ fontSize: 10, color: subMode?"#ca8a04":"#a855f7", fontWeight: 700 }}>
                  {subMode ? (subSrcPos ? `Esce #${rot[subSrcPos-1]} — seleziona chi entra` : "🔄 Tocca il posto di chi esce") : (correctSrcPos ? `P${correctSrcPos} → tocca destinazione` : "🔧 Tocca la posizione da correggere")}
                </div>
                <button onClick={() => { setSubMode(false); setSubSrcPos(null); setSubBenchOpen(false); setCorrectMode(false); setCorrectSrcPos(null); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { label: "🔄", fn: () => { setSubMode(true); setSubSrcPos(null); setCorrectMode(false); setCorrectSrcPos(null); }, active: subMode,    col: "#ca8a04", tip: "Cambio" },
                { label: "📊", fn: () => { setStatsTab("current"); setShowStats(true); },                                          active: false,       col: "#93c5fd", tip: "Stats"  },
                { label: "🔧", fn: () => { setCorrectMode(true); setCorrectSrcPos(null); setSubMode(false); setSubSrcPos(null); },  active: correctMode, col: "#a855f7", tip: "Correggi" },
                { label: "↩",  fn: handleUndo,  active: false, col: prevSnap?"#22c55e":"#1e3a5f", tip: "Undo", disabled: !prevSnap },
                { label: "📥", fn: handleExport, active: false, col: "#4d7fa8", tip: "Excel" },
              ].map(({ label, fn, active, col, tip, disabled }) => (
                <button key={tip} onClick={disabled ? undefined : fn} title={tip} style={{
                  flex: 1, padding: "7px 2px", borderRadius: 8,
                  background: active ? col+"22" : "#0d1f35",
                  border: `1px solid ${active ? col+"88" : disabled ? "#0d1f35" : "#1e3a5f"}`,
                  color: col, fontWeight: 700, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.3 : 1,
                }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SET OVER ═══ */}
      {fase === "setOver" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 18 }}>
          <div style={{ ...S.card, textAlign: "center", maxWidth: 310, width: "100%" }}>
            <div style={{ fontSize: 38, marginBottom: 5 }}>🏆</div>
            <div style={{ ...S.label, marginBottom: 4 }}>Fine Set {setN}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: endWinner==="A"?"#60a5fa":"#fb923c", marginBottom: 8 }}>Vince {endWinner==="A"?teamALabel:teamBLabel}!</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 3, fontFamily: "monospace" }}>
              <span style={{ color: "#60a5fa" }}>{score.A}</span><span style={{ color: "#1e3a5f", margin: "0 5px" }}>:</span><span style={{ color: "#fb923c" }}>{score.B}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 4, marginBottom: 12 }}>
              <span style={S.tag("#60a5fa")}>A:{setVinti.A}</span><span style={S.tag("#fb923c")}>B:{setVinti.B}</span>
            </div>
            <button onClick={handleNextSet} style={S.btn("linear-gradient(135deg,#16a34a,#15803d)")}>▶  Set {setN + 1}</button>
            <button onClick={handleExport} style={{ width: "100%", marginTop: 7, padding: 9, borderRadius: 11, background: "#0d1f35", border: "1px solid #1e3a5f", color: "#4d7fa8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📥 Excel</button>
          </div>
        </div>
      )}

      {/* ═══ MATCH OVER ═══ — stato sollevato nel componente principale, no hook dentro IIFE */}
      {fase === "matchOver" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 18 }}>
          <div style={{ ...S.card, textAlign: "center", maxWidth: 330, width: "100%" }}>
            <div style={{ fontSize: 44, marginBottom: 6 }}>🏆🎉</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: endWinner==="A"?"#60a5fa":"#fb923c", marginBottom: 6 }}>
              Vince {endWinner==="A"?teamALabel:teamBLabel}!
            </div>
            <div style={{ background: "#060e1a", borderRadius: 12, padding: "12px 16px", margin: "8px 0 14px", border: "1px solid #1e3a5f" }}>
              <div style={{ fontSize: 12, color: "#4d7fa8", marginBottom: 3 }}>{teamALabel} vs {teamBLabel}</div>
              <div style={{ fontSize: 34, fontWeight: 900, fontFamily: "monospace" }}>
                <span style={{ color: "#60a5fa" }}>{setVinti.A}</span>
                <span style={{ color: "#1e3a5f", margin: "0 6px" }}>:</span>
                <span style={{ color: "#fb923c" }}>{setVinti.B}</span>
              </div>
              <div style={{ fontSize: 11, color: "#4d7fa8", marginTop: 2 }}>set vinti</div>
            </div>

            {/* Step 1: download excel */}
            <button onClick={handleExport} style={{ ...S.btn("linear-gradient(135deg,#0369a1,#0284c7)"), marginBottom: 8 }}>
              📥 Scarica resoconto Excel
            </button>

            {/* Step 2: save match */}
            {!matchSaved ? (
              <button onClick={handleSaveMatch} style={{ ...S.btn("linear-gradient(135deg,#7c3aed,#6d28d9)"), marginBottom: 8 }}>
                💾 Salva partita
              </button>
            ) : (
              <div style={{ background: "#1a3a1a", borderRadius: 10, padding: "8px 12px", marginBottom: 8, border: "1px solid #22c55e44" }}>
                <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>✓ Partita salvata</div>
                <div style={{ fontSize: 9, color: "#4d7fa8", marginTop: 2, wordBreak: "break-all" }}>{matchSavedRec && matchLabel(matchSavedRec)}</div>
              </div>
            )}

            <button onClick={handleNewMatch} style={{ width: "100%", padding: 10, borderRadius: 11, background: "none", border: "1px solid #1e3a5f", color: "#4d7fa8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🏠 Torna alla Home
            </button>
          </div>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {fase === "results" && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
          <div style={{ background: "#0a1929", borderBottom: "1px solid #1e3a5f", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setFase("home")} style={{ background: "none", border: "none", color: "#4d7fa8", fontSize: 20, cursor: "pointer" }}>←</button>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Risultati precedenti</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {!savedMatches.length && <div style={{ textAlign: "center", color: "#4d7fa8", padding: 36 }}><div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>Nessuna partita salvata</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[...savedMatches].reverse().map(m => {
                const h = m.homeAway==="home"; const ourSets = h?m.setsA:m.setsB; const theirSets = h?m.setsB:m.setsA; const weWon = ourSets>theirSets;
                return (
                  <div key={m.id} style={{ background: "#0d1f35", borderRadius: 11, border: `1px solid ${weWon?"#16a34a44":"#7f1d1d44"}`, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { setDetailMatch(m); setDetailTab("overview"); setFase("matchDetail"); }}>
                      <div style={{ fontWeight: weWon?900:500, fontSize: 12, color: weWon?"#22c55e":"#9ca3af", lineHeight: 1.4 }}>{matchLabel(m)}</div>
                      <div style={{ fontSize: 10, color: "#4d7fa8", marginTop: 2 }}>{m.teamName} • {m.homeAway==="home"?"Casa":"Trasferta"}</div>
                    </div>
                    <button onClick={() => setSavedMatches(prev => prev.filter(x => x.id!==m.id))} style={{ background: "none", border: "1px solid #3a1f0d", borderRadius: 7, padding: "4px 8px", color: "#ef4444", cursor: "pointer", fontSize: 11 }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MATCH DETAIL ═══ */}
      {fase === "matchDetail" && detailMatch && (() => {
        const m = detailMatch; const mr = m.roster||[];
        const uSets = [...new Set(m.log.map(l=>l.Set))].sort((a,b)=>a-b);
        const tabs = [{key:"overview",label:"📋"},...uSets.map(s=>({key:`s${s}`,label:`S${s}`})),{key:"total",label:"Tot"}];
        const h = m.homeAway==="home"; const weWon = (h?m.setsA:m.setsB)>(h?m.setsB:m.setsA);
        const getDS = tab => {
          const isAll=tab==="total"; const sn=isAll?null:parseInt(tab.slice(1));
          const sl=isAll?m.log:m.log.filter(l=>l.Set===sn);
          const sc=isAll?m.serveCounts:((m.serveCountsBySet||{})[sn]||{});
          const st={}; const ensure=j=>{if(!st[j])st[j]={punti:0,ace:0,errori:0,erroriServ:0,battute:0};};
          mr.forEach(p=>ensure(p.jersey));
          Object.entries(sc).forEach(([j,c])=>{ensure(j);st[j].battute=c;});
          sl.forEach(e=>{const j=e["Maglia responsabile"];if(!j)return;ensure(j);if(e["Squadra punto"]==="A"){st[j].punti++;if(e["Tipo azione"]==="Ace")st[j].ace++;}else if(e["Tipo azione"]==="Errore in battuta"){st[j].errori++;st[j].erroriServ++;}else if(e["Tipo azione"]==="Errore")st[j].errori++;});
          return st;
        };
        return (
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
            <div style={{ background: "#0a1929", borderBottom: "1px solid #1e3a5f", padding: "11px 13px", display: "flex", alignItems: "center", gap: 9 }}>
              <button onClick={() => setFase("results")} style={{ background: "none", border: "none", color: "#4d7fa8", fontSize: 20, cursor: "pointer" }}>←</button>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 900, fontSize: 11, color: weWon?"#22c55e":"#ef4444" }}>{matchLabel(m)}</div></div>
              <button onClick={() => exportMatchToExcel(m)} style={{ padding: "5px 9px", borderRadius: 8, background: "#0d1f35", border: "1px solid #1e3a5f", color: "#4d7fa8", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>📥</button>
            </div>
            <div style={{ display: "flex", gap: 4, padding: "7px 11px", overflowX: "auto", background: "#0a1929", borderBottom: "1px solid #1e3a5f" }}>
              {tabs.map(t=><button key={t.key} onClick={()=>setDetailTab(t.key)} style={{ padding:"4px 10px",borderRadius:18,fontWeight:700,fontSize:10,cursor:"pointer",whiteSpace:"nowrap",border:`1px solid ${detailTab===t.key?"#3b82f6":"#1e3a5f"}`,flexShrink:0,background:detailTab===t.key?"#1d4ed8":"#0d1f35",color:detailTab===t.key?"#fff":"#4d7fa8" }}>{t.label}</button>)}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {detailTab==="overview" && (
                <div>{uSets.map(sn=>{const last=m.log.filter(l=>l.Set===sn).slice(-1)[0];const aw=last&&last["Punti A"]>last["Punti B"];return(<div key={sn} style={{background:"#0d1f35",borderRadius:11,padding:"10px 13px",marginBottom:7,border:"1px solid #1e3a5f",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:11,color:"#4d7fa8"}}>Set {sn}</div><div style={{fontFamily:"monospace",fontWeight:900,fontSize:20}}><span style={{color:aw?"#22c55e":"#60a5fa"}}>{last?.["Punti A"]??0}</span><span style={{color:"#1e3a5f",margin:"0 4px"}}>:</span><span style={{color:!aw?"#22c55e":"#fb923c"}}>{last?.["Punti B"]??0}</span></div><div style={{fontSize:11,color:aw?"#22c55e":"#ef4444",fontWeight:700}}>{aw?m.teamName:m.opponentName}</div></div>);})}</div>
              )}
              {detailTab!=="overview"&&(()=>{const st=getDS(detailTab);const js=mr.map(p=>p.jersey).filter(j=>st[j]);return<StatsTable jerseys={js} statsMap={st} roster={mr}/>;})()}
            </div>
          </div>
        );
      })()}

      {/* ═══ BENCH PICKER ═══ */}
      {subBenchOpen && (
        <div style={S.overlay}>
          <div style={{ ...S.card, width: "100%", maxWidth: 310, border: "1px solid #ca8a0433", animation: "fadeIn 0.2s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 24, marginBottom: 3 }}>🔄</div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>Chi entra?</div>
              <div style={{ fontSize: 11, color: "#4d7fa8", marginTop: 3 }}>
                Esce: <span style={{ color: "#ef4444", fontFamily: "monospace", fontWeight: 700 }}>#{rot[subSrcPos-1]}</span>
                {activeRoster.find(r=>r.jersey===rot[subSrcPos-1])&&<span> — {activeRoster.find(r=>r.jersey===rot[subSrcPos-1]).name}</span>}
              </div>
            </div>
            {!benchPlayers.length ? <div style={{ textAlign: "center", color: "#4d7fa8", fontSize: 12, padding: 12 }}>Nessuna in panchina</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }}>
                {benchPlayers.map(p => (
                  <button key={p.jersey} onClick={() => handleSubPickBench(p.jersey)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 13px", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: 11, cursor: "pointer" }}>
                    <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 18, color: "#60a5fa", width: 38 }}>#{p.jersey}</div>
                    <div style={{ flex: 1, textAlign: "left" }}><div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{p.name}</div><div style={{ fontSize: 10, color: "#4d7fa8" }}>{p.role}</div></div>
                    <div style={{ fontSize: 14, color: "#1e3a5f" }}>›</div>
                  </button>
                ))}
              </div>
            )}
            {subErr2 && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 7, textAlign: "center" }}>{subErr2}</div>}
            <button onClick={cancelSub} style={{ width: "100%", padding: 9, borderRadius: 10, background: "#0d1f35", border: "1px solid #1e3a5f", color: "#4d7fa8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Annulla</button>
          </div>
        </div>
      )}

      {/* ═══ STATS OVERLAY ═══ */}
      {showStats && (() => {
        const tabs = [...availableSets.map(s=>({key:String(s),label:`Set ${s}`})),{key:"current",label:"In corso"},{key:"all",label:"Totale"}];
        const ak = statsTab;
        let sd={}, js=[];
        if(ak==="current"||ak===String(setN)){sd=computeStats(setN);js=[...rot,...Object.keys(sd).filter(j=>!rot.includes(j))].filter(j=>j);}
        else if(ak==="all"){sd=computeStats("all");js=Object.keys(sd).sort((a,b)=>parseInt(a)-parseInt(b));}
        else{sd=computeStats(parseInt(ak));js=Object.keys(sd).sort((a,b)=>parseInt(a)-parseInt(b));}
        return(
          <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",flexDirection:"column",animation:"slideUp 0.3s ease"}}>
            <div style={{flex:1,overflowY:"auto",padding:12}}>
              <div style={{maxWidth:420,margin:"0 auto"}}>
                <div style={{textAlign:"center",marginBottom:8}}><div style={{fontSize:12,fontWeight:900,color:"#60a5fa"}}>📊 STATISTICHE — {teamALabel.toUpperCase()}</div></div>
                <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
                  {tabs.map(t=><button key={t.key} onClick={()=>setStatsTab(t.key)} style={{padding:"4px 10px",borderRadius:18,fontWeight:700,fontSize:10,cursor:"pointer",whiteSpace:"nowrap",border:`1px solid ${ak===t.key?"#3b82f6":"#1e3a5f"}`,flexShrink:0,background:ak===t.key?"#1d4ed8":"#0d1f35",color:ak===t.key?"#fff":"#4d7fa8"}}>{t.label}</button>)}
                </div>
                <StatsTable jerseys={js} statsMap={sd} roster={activeRoster}/>
              </div>
            </div>
            <div style={{padding:"9px 13px",background:"#0a1929",borderTop:"1px solid #1e3a5f",flexShrink:0}}>
              <button onClick={()=>setShowStats(false)} style={S.btn("linear-gradient(135deg,#1d4ed8,#1e40af)")}>← Torna alla partita</button>
            </div>
          </div>
        );
      })()}

      {/* ═══ SAVE TEAM MODAL ═══ */}
      {saveTeamModal && (
        <div style={S.overlay}>
          <div style={{ ...S.card, width: "100%", maxWidth: 295, border: "1px solid #7c3aed44", animation: "fadeIn 0.2s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 24, marginBottom: 3 }}>💾</div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>Salva distinta</div>
            </div>
            {currentTeam && <button onClick={handleSaveTeamOverwrite} style={{ ...S.btn("linear-gradient(135deg,#1d4ed8,#1e40af)"), marginBottom: 7, fontSize: 13 }}>Sovrascrive "{currentTeam.name}"</button>}
            {currentTeam && <div style={{ textAlign: "center", fontSize: 11, color: "#4d7fa8", margin: "3px 0" }}>— oppure —</div>}
            <div style={{ ...S.label, marginBottom: 4, marginTop: 4 }}>Nuova squadra</div>
            <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleSaveTeamNew()} placeholder="Nome (es. Under 15)" style={{ ...S.inp, marginBottom: 7, textAlign: "center" }} />
            <button onClick={handleSaveTeamNew} disabled={!newTeamName.trim()} style={{ ...S.btn("linear-gradient(135deg,#16a34a,#15803d)"), opacity: newTeamName.trim()?1:0.4, marginBottom: 7 }}>Salva come nuova</button>
            <button onClick={() => setSaveTeamModal(false)} style={{ width: "100%", padding: 8, background: "none", border: "none", color: "#2d5a7a", cursor: "pointer", fontSize: 12 }}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}
