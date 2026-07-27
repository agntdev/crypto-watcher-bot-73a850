import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { profile } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Manage alerts", data: "alert:manage", order: 30 });
const composer = new Composer<Ctx>();
function describe(rule: ReturnType<typeof profile>["alerts"][number]): string {
  return rule.type === "threshold" ? `${rule.coin.symbol} ${rule.direction} $${rule.value}` : `${rule.coin.symbol} ${rule.direction} ${rule.value}%`;
}
function keyboard(ctx: Ctx) {
  const p = profile(ctx);
  return inlineKeyboard([...p.alerts.map((rule) => [inlineButton(`Remove ${describe(rule)}`, `alert:askdelete:${rule.id}`)]), [inlineButton("Set cooldown", "prefs:cooldown")], [inlineButton("Back to menu", "menu:main")]]);
}
composer.callbackQuery("alert:manage", async (ctx) => {
  await ctx.answerCallbackQuery();
  const p = profile(ctx);
  if (p.alerts.length === 0) return void await ctx.editMessageText("No alerts yet — create one when you want a price update.", { reply_markup: inlineKeyboard([[inlineButton("Create alert", "alert:create")], [inlineButton("Back to menu", "menu:main")]]) });
  await ctx.editMessageText(`Your active alerts:\n${p.alerts.map((rule) => `• ${describe(rule)} — ${rule.cooldownMinutes}-minute cooldown`).join("\n")}`, { reply_markup: keyboard(ctx) });
});
composer.callbackQuery(/^alert:askdelete:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rule = profile(ctx).alerts.find((item) => item.id === Number(ctx.match[1]));
  if (!rule) return void await ctx.editMessageText("That alert has already been removed.", { reply_markup: keyboard(ctx) });
  await ctx.editMessageText(`Remove ${describe(rule)}? This cannot be undone.`, { reply_markup: inlineKeyboard([[inlineButton("Remove alert", `alert:delete:${rule.id}`), inlineButton("Keep alert", "alert:manage")]]) });
});
composer.callbackQuery(/^alert:delete:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const p = profile(ctx); const id = Number(ctx.match[1]); const rule = p.alerts.find((item) => item.id === id);
  if (!rule) return void await ctx.editMessageText("That alert has already been removed.", { reply_markup: keyboard(ctx) });
  p.alerts = p.alerts.filter((item) => item.id !== id);
  await ctx.editMessageText(`${describe(rule)} was removed.`, { reply_markup: keyboard(ctx) });
});
export default composer;
