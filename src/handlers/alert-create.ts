import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import type { AlertType, Coin, Direction } from "../crypto.js";
import { coinById, profile, privateChat, SUGGESTED_COINS, now } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Create alert", data: "alert:create", order: 20 });
const composer = new Composer<Ctx>();
const back = [inlineButton("Back to menu", "menu:main")];

composer.callbackQuery("alert:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!privateChat(ctx)) return void await ctx.editMessageText("Crypto Watcher is available in a private chat.");
  await ctx.editMessageText("Choose what should trigger your alert.", { reply_markup: inlineKeyboard([[inlineButton("Price threshold", "alert:type:threshold")], [inlineButton("24h price move", "alert:type:move")], back]) });
});
composer.callbackQuery(/^alert:type:(threshold|move)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const type = ctx.match[1] as AlertType;
  const coins = profile(ctx).watchlist.length ? profile(ctx).watchlist : SUGGESTED_COINS;
  await ctx.editMessageText("Choose a coin.", { reply_markup: inlineKeyboard([...coins.map((coin) => [inlineButton(coin.name, `alert:coin:${type}:${coin.id}`)]), back]) });
});
composer.callbackQuery(/^alert:coin:(threshold|move):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const type = ctx.match[1] as AlertType; const coin = coinById(ctx.match[2]) ?? profile(ctx).watchlist.find((item) => item.id === ctx.match[2]);
  if (!coin) return void await ctx.editMessageText("Choose a coin from your watchlist.", { reply_markup: inlineKeyboard([back]) });
  const buttons = type === "threshold"
    ? [inlineButton("Price goes above", `alert:dir:${type}:${coin.id}:above`), inlineButton("Price goes below", `alert:dir:${type}:${coin.id}:below`)]
    : [inlineButton("Moves up", `alert:dir:${type}:${coin.id}:up`), inlineButton("Moves down", `alert:dir:${type}:${coin.id}:down`)];
  await ctx.editMessageText("Choose the direction.", { reply_markup: inlineKeyboard([buttons, back]) });
});
composer.callbackQuery(/^alert:dir:(threshold|move):(.+):(above|below|up|down)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, type, id, direction] = ctx.match;
  const coin = coinById(id) ?? profile(ctx).watchlist.find((item) => item.id === id);
  if (!coin) return void await ctx.editMessageText("Choose a coin from your watchlist.");
  ctx.session.flow = { step: "alert-value", type: type as AlertType, coin, direction: direction as Direction, expiresAt: now().getTime() + 5 * 60_000 };
  const wording = type === "threshold" ? "Send the target price in USD, for example 65000." : "Send the 24-hour move as a percent, for example 5.";
  await ctx.editMessageText(wording, { reply_markup: inlineKeyboard([[inlineButton("Cancel", "menu:main")]]) });
});
composer.on("message:text", async (ctx, next) => {
  const flow = ctx.session.flow;
  if (!flow || flow.step !== "alert-value") return next();
  if (now().getTime() > flow.expiresAt) { ctx.session.flow = { step: "idle" }; await ctx.reply("That setup expired. Start a new alert from the menu."); return; }
  const value = Number(ctx.message.text.trim().replace(/[$,%\s]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return void await ctx.reply("Send a positive number so I can save the alert.");
  const p = profile(ctx);
  p.alerts.push({ id: p.nextAlertId++, type: flow.type, coin: flow.coin, direction: flow.direction, value, cooldownMinutes: p.cooldownMinutes });
  ctx.session.flow = { step: "idle" };
  const condition = flow.type === "threshold" ? `${flow.direction} $${value}` : `${flow.direction} ${value}% in 24 hours`;
  await ctx.reply(`${flow.coin.name} alert saved: ${condition}. Cooldown is ${p.cooldownMinutes} minutes.`, { reply_markup: inlineKeyboard([[inlineButton("Manage alerts", "alert:manage")], [inlineButton("Back to menu", "menu:main")]]) });
});
export default composer;
