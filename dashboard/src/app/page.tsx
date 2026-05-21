"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────
type Tab = "paper" | "live" | "health" | "reports";

interface UnlockLevel {
  level: number; capital: number; maxPosition: number;
  maxDailyLoss: number; minWinRate: number; liveEnabled: boolean;
}

interface PaperState {
  capital: number; pnl: number; active: boolean; paused: boolean;
  totalTrades: number; winRate: number | null;
}

interface LiveState {
  liveActive: boolean; portfolioBalance: number; dailyPnl: number;
  dailyTrades: number; totalTrades: number; winRate: number | null;
  maxDailyTrades: number; credentialsValid: boolean; unlockLevel: UnlockLevel;
}

interface Agents { [key: string]: string; }

interface Stats {
  systemMode: string; signals: unknown[];
  agents: Agents;
}

interface Health {
  dataPipeline: { status: string; orderbookSnakes: number };
  signalAgents: { status: string; oracleLag: number; regime: number; volumeSurge: number };
  metaJudge: { status: string; orchestrator: boolean };
}

interface ApiPostFn { (url: string, body: Record<string, unknown>): Promise<void>; }

// ── Constants ──────────────────────────────────────────────────────
const API = {
  paperStatus:  "/api/paper/status",
  liveStatus:   "/api/live/status",
  stats:        "/api/stats",
  healthSummary:"/api/health/summary",
  paperControl: "/api/paper/control",
  liveControl:  "/api/live/control",
  calibrateRun: "/api/calibrate/run",
} as const;

const POLL_MS = 5000;

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "paper", label: "Paper Trading", icon: "📄" },
  { key: "live", label: "Live Trading", icon: "🔴" },
  { key: "health", label: "System Health", icon: "💚" },
  { key: "reports", label: "Reports & Export", icon: "📊" },
];

const PAPER_ACTIONS = [
  { action: "start", color: "#22c55e" },
  { action: "pause", color: "#eab308" },
  { action: "stop", color: "#ef4444" },
];

const LIVE_ACTIONS = [
  { action: "start", color: "#22c55e" },
  { action: "pause", color: "#eab308" },
  { action: "stop", color: "#ef4444" },
];

function getAuthHeaders(): Record<string, string> {
  const pw = sessionStorage.getItem("dashboard_password") ?? "";
  const pin = sessionStorage.getItem("dashboard_pin") ?? "";
  return { "Content-Type": "application/json", "X-Dashboard-Auth": `${pw}:${pin}` };
}

// ── Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("paper");
  const [paperState, setPaperState] = useState<PaperState>({ capital: 0, pnl: 0, active: false, paused: false, totalTrades: 0, winRate: null });
  const [liveState, setLiveState] = useState<LiveState>({ liveActive: false, portfolioBalance: 0, dailyPnl: 0, dailyTrades: 0, totalTrades: 0, winRate: null, maxDailyTrades: 50, credentialsValid: false, unlockLevel: { level: 1, capital: 100, maxPosition: 2, maxDailyLoss: 10, minWinRate: 0.55, liveEnabled: false } });
  const [stats, setStats] = useState<Stats>({ systemMode: "NORMAL", signals: [], agents: {} });
  const [health, setHealth] = useState<Health>({ dataPipeline: { status: "green", orderbookSnakes: 0 }, signalAgents: { status: "green", oracleLag: 0, regime: 0, volumeSurge: 0 }, metaJudge: { status: "green", orchestrator: false } });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Data polling
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const headers = getAuthHeaders();
        const [pRes, lRes, sRes, hRes] = await Promise.all([
          fetch(API.paperStatus, { headers }),
          fetch(API.liveStatus, { headers }),
          fetch(API.stats, { headers }),
          fetch(API.healthSummary, { headers }),
        ]);
        if (!active) return;
        if (pRes.ok) setPaperState(await pRes.json().catch(() => ({})));
        if (lRes.ok) setLiveState(await lRes.json().catch(() => ({})));
        if (sRes.ok) setStats(await sRes.json().catch(() => ({})));
        if (hRes.ok) setHealth(await hRes.json().catch(() => ({})));
        setLoading(false);
      } catch { /* silent poll failure */ }
    };
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => { active = false; clearInterval(iv); };
  }, []);

  const apiPost: ApiPostFn = useCallback(async (url, body) => {
    const res = await fetch(url, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
    if (!res.ok) console.error("[API] Request failed:", url, res.status);
  }, []);

  const timeStr = useMemo(() => now.toLocaleTimeString("en-US", { hour12: false }), [now]);
  const onlineAgents = Object.values(stats.agents).filter((v) => v === "online").length;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#0a0e17", color: "#e0e0e0", minHeight: "100vh" }}>
      <header style={S.header}>
        <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
          {tab === "paper" && "Paper Trading Workspace"}
          {tab === "live" && "Live Trading Workspace"}
          {tab === "health" && "System Health"}
          {tab === "reports" && "Reports & Export"}
        </h1>
        <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>
          {timeStr} UTC · {stats.systemMode} · {onlineAgents} agents online
        </span>
      </header>

      <nav style={S.nav}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...S.tabBtn, background: tab === t.key ? "#1d4ed8" : "transparent", color: tab === t.key ? "#fff" : "#9ca3af", borderColor: tab === t.key ? "#1d4ed8" : "#1f2937" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: "1rem 1.5rem" }}>
        {loading && <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>Loading...</div>}
        {!loading && tab === "paper" && <PaperWorkspace paperState={paperState} stats={stats} apiPost={apiPost} />}
        {!loading && tab === "live" && <LiveWorkspace liveState={liveState} stats={stats} apiPost={apiPost} />}
        {!loading && tab === "health" && <HealthWorkspace health={health} stats={stats} apiPost={apiPost} />}
        {!loading && tab === "reports" && <ReportsWorkspace />}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function PaperWorkspace({ paperState, stats, apiPost }: { paperState: PaperState; stats: Stats; apiPost: ApiPostFn }) {
  const isRunning = paperState.active && !paperState.paused;
  const bal = paperState.capital + paperState.pnl;
  const agentsOnline = Object.values(stats.agents).filter((v) => v === "online").length;
  const statusColor = isRunning ? "#22c55e" : "#6b7280";
  const statusText = paperState.active ? (paperState.paused ? "PAUSED" : "RUNNING") : "STOPPED";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={S.controlsBar}>
        {PAPER_ACTIONS.map((b) => (
          <button key={b.action} onClick={() => apiPost(API.paperControl, { action: b.action })}
            style={{ ...S.btn, background: b.action === "start" && isRunning ? "#16a34a" : b.color }}>
            {b.action.charAt(0).toUpperCase() + b.action.slice(1)}
          </button>
        ))}
        <button onClick={() => apiPost(API.paperControl, { action: "resetDailyLimits" })} style={{ ...S.btn, background: "#4b5563" }}>Reset Limits</button>
        <button onClick={() => apiPost(API.paperControl, { action: "simulateTrade" })} style={{ ...S.btn, background: "#8b5cf6" }}>Simulate Trade</button>
        <button onClick={() => apiPost(API.calibrateRun, {})} style={{ ...S.btn, background: "#f59e0b", color: "#000" }}>Calibrate</button>
        <span style={{ marginLeft: "auto", fontSize: "0.8rem" }}>
          Status: <span style={{ color: statusColor }}>{statusText}</span>
        </span>
      </div>
      <div style={S.grid}>
        {[
          ["PAPER BALANCE", `$${bal.toFixed(2)}`, "equity"],
          ["P&L", `${paperState.pnl >= 0 ? "+" : ""}$${paperState.pnl.toFixed(2)}`, "--"],
          ["TRADES", paperState.totalTrades, "--"],
          ["WIN RATE", paperState.winRate ?? "--%", "--"],
          ["SIGNALS", stats.signals.length, "unified stream"],
          ["AGENTS", agentsOnline, "online"],
        ].map(([label, val, sub], i) => (
          <div key={i} style={S.card}>
            <div style={S.cardLabel}>{label}</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, fontFamily: "monospace", marginTop: "0.25rem" }}>{val}</div>
            <div style={{ fontSize: "0.6rem", color: "#4b5563" }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveWorkspace({ liveState, stats, apiPost }: { liveState: LiveState; stats: Stats; apiPost: ApiPostFn }) {
  const isRunning = liveState.liveActive;
  const ul = liveState.unlockLevel;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={S.controlsBar}>
        {LIVE_ACTIONS.map((b) => (
          <button key={b.action} onClick={() => apiPost(API.liveControl, { action: b.action })}
            style={{ ...S.btn, background: b.action === "start" && isRunning ? "#16a34a" : b.color }}>
            {b.action.charAt(0).toUpperCase() + b.action.slice(1)}
          </button>
        ))}
        <button onClick={() => apiPost(API.liveControl, { action: "resetDailyLimits" })} style={{ ...S.btn, background: "#4b5563" }}>Reset Limits</button>
        <span style={{ marginLeft: "auto", fontSize: "0.8rem" }}>
          L{ul.level} · Status: <span style={{ color: isRunning ? "#22c55e" : "#6b7280" }}>{isRunning ? "RUNNING" : "STOPPED"}</span>
        </span>
      </div>
      <div style={S.grid}>
        {[
          ["PORTFOLIO BALANCE", liveState.portfolioBalance != null ? `$${liveState.portfolioBalance.toFixed(2)}` : "--", `L${ul.level}`],
          ["P&L", `${liveState.dailyPnl >= 0 ? "+" : ""}$${liveState.dailyPnl.toFixed(2)}`, `trades: ${liveState.dailyTrades}`],
          ["TRADES", liveState.totalTrades, "--"],
          ["WIN RATE", liveState.winRate ?? "--%", "oracle-lag"],
          ["LEVEL", `Level ${ul.level}`, `$${ul.capital} cap`],
          ["MAX TRADES", liveState.dailyTrades, `of ${liveState.maxDailyTrades}`],
        ].map(([label, val, sub], i) => (
          <div key={i} style={S.card}>
            <div style={S.cardLabel}>{label}</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, fontFamily: "monospace", marginTop: "0.25rem" }}>{val}</div>
            <div style={{ fontSize: "0.6rem", color: "#4b5563" }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthWorkspace({ health, stats, apiPost }: { health: Health; stats: Stats; apiPost: ApiPostFn }) {
  const dp = health.dataPipeline;
  const sa = health.signalAgents;
  const mj = health.metaJudge;
  const items = [
    { label: "Data Pipeline", status: dp.status, sub: `${dp.orderbookSnakes}/4 snakes` },
    { label: "Signal Agents", status: sa.status, sub: `${sa.oracleLag} oracle ${sa.regime} regime ${sa.volumeSurge} vol` },
    { label: "Meta-Judge", status: mj.status, sub: mj.orchestrator ? "orchestrator online" : "orchestrator offline" },
    { label: "Hermes", status: "green", sub: "advisory active" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={S.controlsBar}>
        <button onClick={() => apiPost(API.calibrateRun, {})} style={{ ...S.btn, background: "#f59e0b", color: "#000" }}>Run Calibration</button>
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#6b7280" }}>Calibrates agent thresholds, unlocks levels, and validates system health</span>
      </div>
      <div style={S.grid}>
        {items.map((c, i) => (
          <div key={i} style={{ ...S.card, borderColor: c.status === "green" ? "#22c55e33" : c.status === "yellow" ? "#eab30833" : "#ef444433" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>{c.status === "green" ? "🟢" : c.status === "yellow" ? "🟡" : "🔴"}</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: "0.6rem", color: "#6b7280", marginTop: "0.25rem" }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsWorkspace() {
  return (
    <div style={S.card}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📥</div>
        <h3 style={{ margin: 0, marginBottom: "0.5rem" }}>Export Research Data</h3>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
          {["daily", "weekly", "monthly", "all"].map((tf) => (
            <a key={tf} href={`/api/export?timeframe=${tf}`} style={{ ...S.btn, background: "#1d4ed8", textDecoration: "none", textTransform: "capitalize" }}>
              Export {tf}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.75rem 1.5rem", borderBottom: "1px solid #1f2937", background: "#0d1321",
  },
  nav: {
    display: "flex", gap: "0.25rem", padding: "0.5rem 1.5rem",
    borderBottom: "1px solid #1f2937", background: "#0d1321",
  },
  tabBtn: {
    padding: "0.4rem 1rem", borderRadius: 6, border: "1px solid #1f2937",
    cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, transition: "background 0.15s",
  },
  controlsBar: {
    display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem",
    background: "#0d1321", borderRadius: 8, border: "1px solid #1f2937", flexWrap: "wrap",
  },
  btn: {
    padding: "0.35rem 0.75rem", borderRadius: 6, border: "none",
    color: "#fff", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem",
  },
  card: {
    background: "#0d1321", border: "1px solid #1f2937", borderRadius: 8, padding: "0.75rem 1rem",
  },
  cardLabel: {
    fontSize: "0.65rem", color: "#6b7280", textTransform: "uppercase",
  },
};
