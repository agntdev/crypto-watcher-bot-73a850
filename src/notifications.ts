import type { Ctx } from "./bot.js";
import { currency, evaluateAlert, inQuietHours, now, prices, profile } from "./crypto.js";

/**
 * Notification job entry point. A host scheduler calls this once for a user's
 * chat; it contains no process-local state, so retries and restarts are safe.
 */
export async function dispatchNotifications(ctx: Ctx): Promise<void> {
  const p = profile(ctx);
  if (!p.alerts.length && !p.summaryTime) return;
  let quotes: Record<string, { usd: number; change: number }>;
  try { quotes = await prices([...p.watchlist, ...p.alerts.map((rule) => rule.coin)]); }
  catch { return; } // scheduled price-feed failures are retried by the next run without user noise
  const at = now();
  for (const rule of p.alerts) {
    const quote = quotes[rule.coin.id]; if (!quote) continue;
    const outcome = evaluateAlert(p, rule, quote.usd, quote.change, at);
    if (outcome === "send") {
      const detail = rule.type === "threshold" ? `${currency(quote.usd)} crossed your ${rule.direction} target of ${currency(rule.value)}` : `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}% over 24 hours`;
      try { await ctx.reply(`${rule.coin.name}: ${detail}.`); } catch { /* blocked chats do not stop other jobs */ }
    }
  }
  await dispatchMorningSummary(ctx, quotes, at);
}

export async function dispatchMorningSummary(ctx: Ctx, quotes?: Record<string, { usd: number; change: number }>, at = now()): Promise<void> {
  const p = profile(ctx); if (!p.summaryTime || !p.watchlist.length || inQuietHours(p, at)) return;
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: p.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const value = (type: string) => local.find((part) => part.type === type)?.value ?? "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  if (`${value("hour")}:${value("minute")}` !== p.summaryTime || p.lastSummaryDate === date) return;
  const live = quotes ?? await prices(p.watchlist);
  const lines = p.watchlist.flatMap((coin) => live[coin.id] ? [`${coin.symbol} ${currency(live[coin.id].usd)} (${live[coin.id].change >= 0 ? "+" : ""}${live[coin.id].change.toFixed(2)}%)`] : []);
  if (!lines.length) return;
  try { await ctx.reply(`Morning market summary\n${lines.join("\n")}`); p.lastSummaryDate = date; } catch { /* consent can be withdrawn by blocking the bot */ }
}
