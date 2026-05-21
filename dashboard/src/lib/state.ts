// ── In-memory system state (survives hot reload, resets on cold start) ──

export interface UnlockLevel {
  level: number; capital: number; maxPosition: number;
  maxDailyLoss: number; minWinRate: number; liveEnabled: boolean;
}

export interface PaperState {
  capital: number; pnl: number; active: boolean; paused: boolean;
  totalTrades: number; winRate: number | null; dailyTrades: number;
}

export interface LiveState {
  liveActive: boolean; portfolioBalance: number; dailyPnl: number;
  dailyTrades: number; totalTrades: number; winRate: number | null;
  maxDailyTrades: number; credentialsValid: boolean; unlockLevel: UnlockLevel;
}

export interface AgentStatus {
  status: "green" | "yellow" | "red";
  latency: number;
  lastSignal: number; // epoch ms
  signalCount: number;
}

export interface CalibrationParams {
  lastRun: number | null; // epoch ms
  oracleLagThreshold: number;
  regimeThreshold: number;
  volumeSurgeThreshold: number;
  metaJudgeConfidence: number;
  paperPositionSizing: number; // fraction 0-1
}

export interface HealthState {
  dataPipeline: { status: string; orderbookSnakes: number };
  signalAgents: { status: string; oracleLag: number; regime: number; volumeSurge: number };
  metaJudge: { status: string; orchestrator: boolean };
}

export interface SystemState {
  mode: "NORMAL" | "CALIBRATING" | "LOCKED";
  paper: PaperState;
  live: LiveState;
  agents: Record<string, AgentStatus>;
  calibration: CalibrationParams;
}

// ── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_UNLOCK_LEVEL: UnlockLevel = {
  level: 1, capital: 100, maxPosition: 2, maxDailyLoss: 10, minWinRate: 0.55, liveEnabled: false,
};

const DEFAULT_CALIBRATION: CalibrationParams = {
  lastRun: null,
  oracleLagThreshold: 4,
  regimeThreshold: 4,
  volumeSurgeThreshold: 4,
  metaJudgeConfidence: 0.8,
  paperPositionSizing: 0.25,
};

const AGENT_NAMES = [
  "orderbook-snake-btc", "orderbook-snake-eth", "orderbook-snake-sol", "orderbook-snake-xrp",
  "regime-oracle-btc", "regime-oracle-eth", "regime-oracle-sol", "regime-oracle-xrp",
  "oracle-lag-agent-btc", "oracle-lag-agent-eth", "oracle-lag-agent-sol", "oracle-lag-agent-xrp",
  "orchestrator",
];

function freshAgentStates(): Record<string, AgentStatus> {
  const out: Record<string, AgentStatus> = {};
  for (const name of AGENT_NAMES) {
    out[name] = { status: "green", latency: 0, lastSignal: 0, signalCount: 0 };
  }
  return out;
}

// ── Global store ─────────────────────────────────────────────────────

const state: SystemState = {
  mode: "NORMAL",
  paper: { capital: 1000, pnl: 0, active: false, paused: false, totalTrades: 0, winRate: null, dailyTrades: 0 },
  live: {
    liveActive: false, portfolioBalance: 0, dailyPnl: 0, dailyTrades: 0, totalTrades: 0,
    winRate: null, maxDailyTrades: 50, credentialsValid: false, unlockLevel: { ...DEFAULT_UNLOCK_LEVEL },
  },
  agents: freshAgentStates(),
  calibration: { ...DEFAULT_CALIBRATION },
};

// ── Accessors ────────────────────────────────────────────────────────

export function getState(): Readonly<SystemState> { return state; }

export function getPaperState(): PaperState { return { ...state.paper }; }
export function getLiveState(): LiveState { return { ...state.live }; }

export function controlPaper(action: string): { success: boolean; message: string } {
  switch (action) {
    case "start":
      state.paper.active = true;
      state.paper.paused = false;
      return { success: true, message: "Paper trading started" };
    case "pause":
      if (!state.paper.active) return { success: false, message: "Paper trading not active" };
      state.paper.paused = true;
      return { success: true, message: "Paper trading paused" };
    case "stop":
      state.paper.active = false;
      state.paper.paused = false;
      return { success: true, message: "Paper trading stopped" };
    case "resetDailyLimits":
      state.paper.dailyTrades = 0;
      return { success: true, message: "Daily limits reset" };
    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}

export function controlLive(action: string): { success: boolean; message: string } {
  switch (action) {
    case "start":
      state.live.liveActive = true;
      return { success: true, message: "Live trading started" };
    case "pause":
      if (!state.live.liveActive) return { success: false, message: "Live trading not active" };
      return { success: true, message: "Live trading paused" };
    case "stop":
      state.live.liveActive = false;
      return { success: true, message: "Live trading stopped" };
    case "resetDailyLimits":
      state.live.dailyTrades = 0;
      return { success: true, message: "Daily limits reset" };
    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}

export function runCalibration(): { success: boolean; params: CalibrationParams; health: HealthState } {
  state.mode = "CALIBRATING";

  // Simulate calibration: sample agent latencies and compute thresholds
  const snakeAgents = AGENT_NAMES.filter(n => n.startsWith("orderbook"));
  const regimeAgents = AGENT_NAMES.filter(n => n.startsWith("regime"));
  const oracleAgents = AGENT_NAMES.filter(n => n.startsWith("oracle-lag"));

  for (const name of AGENT_NAMES) {
    const agent = state.agents[name];
    agent.latency = Math.round((2 + Math.random() * 8) * 10) / 10; // 2-10ms
    agent.lastSignal = Date.now();
    agent.signalCount += Math.floor(Math.random() * 3);
    agent.status = agent.latency > 8 ? "yellow" : agent.latency > 9.5 ? "red" : "green";
  }

  // Compute calibrated thresholds from agent data
  const snakeLatencies = snakeAgents.map(n => state.agents[n].latency);
  const regimeLatencies = regimeAgents.map(n => state.agents[n].latency);
  const oracleLatencies = oracleAgents.map(n => state.agents[n].latency);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  state.calibration = {
    lastRun: Date.now(),
    oracleLagThreshold: Math.round(avg(oracleLatencies) * 1.2 * 10) / 10,
    regimeThreshold: Math.round(avg(regimeLatencies) * 1.15 * 10) / 10,
    volumeSurgeThreshold: Math.round(avg(snakeLatencies) * 1.1 * 10) / 10,
    metaJudgeConfidence: Math.round((0.75 + Math.random() * 0.2) * 100) / 100,
    paperPositionSizing: state.paper.active ? Math.round((0.2 + Math.random() * 0.15) * 100) / 100 : 0.25,
  };

  // Compute health
  const snakeOnline = snakeAgents.filter(n => state.agents[n].status === "green").length;
  const avgOracleLag = Math.round(avg(oracleLatencies) * 10) / 10;
  const avgRegime = Math.round(avg(regimeLatencies) * 10) / 10;
  const avgVolume = Math.round(avg(snakeLatencies) * 10) / 10;
  const allGreen = AGENT_NAMES.every(n => state.agents[n].status === "green");
  const anyRed = AGENT_NAMES.some(n => state.agents[n].status === "red");

  const health: HealthState = {
    dataPipeline: { status: snakeOnline >= 3 ? "green" : snakeOnline >= 2 ? "yellow" : "red", orderbookSnakes: snakeOnline },
    signalAgents: { status: avgOracleLag < 8 ? "green" : "yellow", oracleLag: avgOracleLag, regime: avgRegime, volumeSurge: avgVolume },
    metaJudge: { status: allGreen ? "green" : anyRed ? "red" : "yellow", orchestrator: state.agents["orchestrator"]?.status === "green" },
  };

  // Progress unlock level if conditions met
  const ul = state.live.unlockLevel;
  if (state.paper.winRate !== null && state.paper.winRate >= ul.minWinRate && state.paper.totalTrades >= 10 && ul.level < 5) {
    const nextLevel = ul.level + 1;
    state.live.unlockLevel = {
      level: nextLevel,
      capital: ul.capital * 2,
      maxPosition: ul.maxPosition + 1,
      maxDailyLoss: ul.maxDailyLoss + 5,
      minWinRate: Math.round((ul.minWinRate + 0.02) * 100) / 100,
      liveEnabled: nextLevel >= 3,
    };
  }

  state.mode = "NORMAL";
  return { success: true, params: { ...state.calibration }, health };
}

export function getStats() {
  const agents: Record<string, string> = {};
  for (const [name, a] of Object.entries(state.agents)) {
    agents[name] = a.status === "green" ? "online" : a.status === "yellow" ? "degraded" : "offline";
  }
  return {
    systemMode: state.mode,
    signals: AGENT_NAMES.filter(n => n.startsWith("orderbook")).map(n => ({
      agent: n, latency: state.agents[n].latency, count: state.agents[n].signalCount,
    })),
    agents,
  };
}

export function getHealth(): HealthState {
  const latencies = Object.values(state.agents).map(a => a.latency).filter(Boolean);
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgLatency = Math.round(avg(latencies) * 10) / 10;
  const snakeOnline = AGENT_NAMES.filter(n => n.startsWith("orderbook") && state.agents[n].status === "green").length;

  return {
    dataPipeline: { status: snakeOnline >= 3 ? "green" : snakeOnline >= 2 ? "yellow" : "red", orderbookSnakes: snakeOnline },
    signalAgents: { status: avgLatency < 8 ? "green" : "yellow", oracleLag: avgLatency, regime: avgLatency, volumeSurge: avgLatency },
    metaJudge: { status: state.agents["orchestrator"]?.status ?? "green", orchestrator: state.agents["orchestrator"]?.status === "green" },
  };
}

// Simulate a paper trade to build up track record for calibration
export function simulateTrade(): { pnl: number } {
  const win = Math.random() > 0.45;
  const amount = Math.round((5 + Math.random() * 20) * 100) / 100;
  const pnl = win ? amount : -amount;

  const p = state.paper;
  p.pnl += pnl;
  p.totalTrades += 1;
  p.dailyTrades += 1;
  p.capital += pnl;
  const wins = p.totalTrades > 0 ? Math.round((p.winRate ?? 0) * p.totalTrades + (win ? 1 : 0)) / (p.totalTrades) : 0;
  p.winRate = Math.round(wins * 100) / 100;

  if (state.live.liveActive) {
    const l = state.live;
    l.dailyPnl += pnl;
    l.totalTrades += 1;
    l.dailyTrades += 1;
    l.portfolioBalance += pnl;
    const lWins = l.totalTrades > 0 ? (l.winRate ?? 0) * (l.totalTrades - 1) / l.totalTrades + (win ? 1 / l.totalTrades : 0) : 0;
    l.winRate = Math.round(lWins * 100) / 100;
  }

  return { pnl: Math.round(pnl * 100) / 100 };
}
