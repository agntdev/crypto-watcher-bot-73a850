import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ctx } from "../src/bot.js";
import { evaluateAlert, setClockForTests, type AlertRule, type UserProfile } from "../src/crypto.js";
import { dispatchMorningSummary } from "../src/notifications.js";

function account(): UserProfile {
  return { watchlist: [{ id: "bitcoin", symbol: "BTC", name: "Bitcoin" }], alerts: [], cooldownMinutes: 10, quietHours: { start: 22, end: 7 }, timezone: "UTC", nextAlertId: 1 };
}
function threshold(): AlertRule {
  return { id: 1, type: "threshold", coin: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" }, direction: "above", value: 100, cooldownMinutes: 10 };
}
afterEach(() => setClockForTests());

describe("scheduled notification rules", () => {
  it("suppresses repeated threshold crossings during cooldown", () => {
    const p = account(); const rule = threshold();
    expect(evaluateAlert(p, rule, 101, 0, new Date("2026-07-27T12:00:00Z"))).toBe("send");
    expect(evaluateAlert(p, rule, 101, 0, new Date("2026-07-27T12:05:00Z"))).toBe("skip");
    expect(evaluateAlert(p, rule, 101, 0, new Date("2026-07-27T12:10:00Z"))).toBe("send");
  });
  it("queues alerts during quiet hours and delivers after them", () => {
    const p = account(); const rule = threshold();
    expect(evaluateAlert(p, rule, 101, 0, new Date("2026-07-27T23:00:00Z"))).toBe("queue");
    expect(rule.queued).toBe(true);
    expect(evaluateAlert(p, rule, 101, 0, new Date("2026-07-28T08:00:00Z"))).toBe("send");
    expect(rule.queued).toBe(false);
  });
  it("sends a morning summary once at the user's local time", async () => {
    const p = account(); p.summaryTime = "08:00";
    const reply = vi.fn().mockResolvedValue({});
    const ctx = { session: { profile: p }, reply } as unknown as Ctx;
    setClockForTests(() => new Date("2026-07-27T08:00:00Z"));
    await dispatchMorningSummary(ctx, { bitcoin: { usd: 100, change: 1.25 } });
    expect(reply).toHaveBeenCalledWith("Morning market summary\nBTC $100.00 (+1.25%)");
    await dispatchMorningSummary(ctx, { bitcoin: { usd: 100, change: 1.25 } });
    expect(reply).toHaveBeenCalledTimes(1);
  });
});
