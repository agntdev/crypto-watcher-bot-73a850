import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { profile } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Notification settings", data: "prefs:show", order: 50 });
const composer = new Composer<Ctx>();
function settings(ctx: Ctx) {
  const p = profile(ctx); const summary = p.summaryTime ? `${p.summaryTime} ${p.timezone}` : "Off";
  return { text: `Quiet hours: ${p.quietHours.start}:00–${p.quietHours.end}:00\nMorning summary: ${summary}\nCooldown: ${p.cooldownMinutes} minutes`, reply_markup: inlineKeyboard([[inlineButton("Set quiet hours", "prefs:quiet")], [inlineButton("Set morning summary", "prefs:summary")], [inlineButton("Set cooldown", "prefs:cooldown")], [inlineButton("Back to menu", "menu:main")]]) };
}
composer.callbackQuery("prefs:show", async (ctx) => { await ctx.answerCallbackQuery(); const view = settings(ctx); await ctx.editMessageText(view.text, { reply_markup: view.reply_markup }); });
composer.callbackQuery("prefs:quiet", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Choose when price alerts should stay quiet.", { reply_markup: inlineKeyboard([[inlineButton("10 PM–7 AM", "quiet:22:7"), inlineButton("11 PM–7 AM", "quiet:23:7")], [inlineButton("No quiet hours", "quiet:0:0")], [inlineButton("Back", "prefs:show")]]) }); });
composer.callbackQuery(/^quiet:(\d{1,2}):(\d{1,2})$/, async (ctx) => { await ctx.answerCallbackQuery(); const p = profile(ctx); p.quietHours = { start: Number(ctx.match[1]), end: Number(ctx.match[2]) }; const view = settings(ctx); await ctx.editMessageText("Quiet hours updated.\n" + view.text, { reply_markup: view.reply_markup }); });
composer.callbackQuery("prefs:summary", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Choose a local time for your morning market summary.", { reply_markup: inlineKeyboard([[inlineButton("7:00", "summary:07:00"), inlineButton("8:00", "summary:08:00")], [inlineButton("Turn off", "summary:off")], [inlineButton("Back", "prefs:show")]]) }); });
composer.callbackQuery(/^summary:(07:00|08:00|off)$/, async (ctx) => { await ctx.answerCallbackQuery(); const p = profile(ctx); p.summaryTime = ctx.match[1] === "off" ? undefined : ctx.match[1]; const view = settings(ctx); await ctx.editMessageText(p.summaryTime ? `Morning summary is set for ${p.summaryTime} ${p.timezone}.` : "Morning summary is off.", { reply_markup: view.reply_markup }); });
export default composer;
