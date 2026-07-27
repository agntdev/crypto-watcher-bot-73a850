import type { Ctx } from "./bot.js";

export type Coin = { id: string; symbol: string; name: string };
export type AlertType = "threshold" | "move";
export type Direction = "above" | "below" | "up" | "down";
export interface AlertRule {
  id: number;
  type: AlertType;
  coin: Coin;
  direction: Direction;
  value: number;
  cooldownMinutes: number;
  baseline?: number;
  lastAlertAt?: number;
  queued?: boolean;
}
export interface UserProfile {
  watchlist: Coin[];
  alerts: AlertRule[];
  cooldownMinutes: number;
  quietHours: { start: number; end: number };
  timezone: string;
  summaryTime?: string;
  lastSummaryDate?: string;
  nextAlertId: number;
}
export type FlowState =
  | { step: "alert-value"; type: AlertType; coin: Coin; direction: Direction; expiresAt: number }
  | { step: "idle" };

export const SUGGESTED_COINS: Coin[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "the-open-network", symbol: "TON", name: "Toncoin" },
];

let clock: () => Date = () => new Date();
/** Injectable clock seam for notification and flow tests. */
export function now(): Date { return clock(); }
export function setClockForTests(value?: () => Date): void { clock = value ?? (() => new Date()); }

export function profile(ctx: Ctx): UserProfile {
  return (ctx.session.profile ??= {
    watchlist: [], alerts: [], cooldownMinutes: 10,
    quietHours: { start: 22, end: 7 }, timezone: "UTC", nextAlertId: 1,
  });
}

export function privateChat(ctx: Ctx): boolean { return ctx.chat?.type === "private"; }
export function menuBack() { return { reply_markup: { inline_keyboard: [[{ text: "Back to menu", callback_data: "menu:main" }]] } }; }

export function coinById(id: string): Coin | undefined { return SUGGESTED_COINS.find((coin) => coin.id === id); }
export function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}

async function request(url: string): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (response.ok) return response;
      last = new Error(`price feed returned ${response.status}`);
    } catch (error) { last = error; }
  }
  throw last instanceof Error ? last : new Error("price feed unavailable");
}

/** CoinGecko's documented search endpoint resolves symbols to canonical coin ids. */
export async function resolveCoin(query: string): Promise<Coin | undefined> {
  const normalized = query.trim().toLowerCase();
  const local = SUGGESTED_COINS.find((coin) => coin.symbol.toLowerCase() === normalized || coin.name.toLowerCase() === normalized);
  if (local) return local;
  const response = await request(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query.trim())}`);
  const body = await response.json() as { coins?: Array<{ id: string; symbol: string; name: string }> };
  const exact = body.coins?.find((coin) => coin.symbol.toLowerCase() === normalized) ?? body.coins?.[0];
  return exact ? { id: exact.id, symbol: exact.symbol.toUpperCase(), name: exact.name } : undefined;
}

export async function prices(coins: Coin[]): Promise<Record<string, { usd: number; change: number }>> {
  if (coins.length === 0) return {};
  const ids = [...new Set(coins.map((coin) => coin.id))];
  const result: Record<string, { usd: number; change: number }> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const response = await request(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.slice(i, i + 50).join(","))}&vs_currencies=usd&include_24hr_change=true`);
    const body = await response.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
    for (const [id, quote] of Object.entries(body)) if (typeof quote.usd === "number") result[id] = { usd: quote.usd, change: quote.usd_24h_change ?? 0 };
  }
  return result;
}

export function inQuietHours(p: UserProfile, at = now()): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: p.timezone, hour: "2-digit", hourCycle: "h23" }).format(at));
  const { start, end } = p.quietHours;
  return start === end ? false : start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function ruleTriggered(rule: AlertRule, price: number, change: number): boolean {
  return rule.type === "threshold"
    ? (rule.direction === "above" ? price >= rule.value : price <= rule.value)
    : (rule.direction === "up" ? change >= rule.value : change <= -rule.value);
}

/** Marks a rule as deliverable, cooling down, or queued for after quiet hours. */
export function evaluateAlert(p: UserProfile, rule: AlertRule, price: number, change: number, at = now()): "send" | "queue" | "skip" {
  if (!ruleTriggered(rule, price, change)) return "skip";
  if (rule.lastAlertAt && at.getTime() - rule.lastAlertAt < rule.cooldownMinutes * 60_000) return "skip";
  if (inQuietHours(p, at)) { rule.queued = true; return "queue"; }
  rule.queued = false;
  rule.lastAlertAt = at.getTime();
  return "send";
}
