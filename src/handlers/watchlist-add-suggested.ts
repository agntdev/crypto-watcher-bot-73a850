import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { coinById, profile, privateChat, SUGGESTED_COINS } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Add coins", data: "watchlist:add_suggested", order: 10 });
const composer = new Composer<Ctx>();
const chooseCoins = inlineKeyboard([
  ...SUGGESTED_COINS.map((coin) => [inlineButton(`Add ${coin.name}`, `watch:add:${coin.id}`)]),
  [inlineButton("Back to menu", "menu:main")],
]);

composer.callbackQuery("watchlist:add_suggested", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!privateChat(ctx)) return void await ctx.editMessageText("Crypto Watcher is available in a private chat.");
  await ctx.editMessageText("Choose a coin to add to your watchlist.", { reply_markup: chooseCoins });
});

composer.callbackQuery(/^watch:add:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const coin = coinById(ctx.match[1]);
  if (!coin) return void await ctx.editMessageText("That coin is no longer available. Choose one from the list.", { reply_markup: chooseCoins });
  const p = profile(ctx);
  if (!p.watchlist.some((item) => item.id === coin.id)) p.watchlist.push(coin);
  await ctx.editMessageText(`${coin.name} is on your watchlist. Alert cooldown is ${p.cooldownMinutes} minutes.`, {
    reply_markup: inlineKeyboard([[inlineButton("Set cooldown", "prefs:cooldown")], [inlineButton("Add another", "watchlist:add_suggested")], [inlineButton("Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery("prefs:cooldown", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Choose how long to wait before the same alert can notify you again.", {
    reply_markup: inlineKeyboard([[inlineButton("5 minutes", "cooldown:5"), inlineButton("10 minutes", "cooldown:10")], [inlineButton("30 minutes", "cooldown:30")], [inlineButton("Back", "watchlist:add_suggested")]]),
  });
});
composer.callbackQuery(/^cooldown:(5|10|30)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const minutes = Number(ctx.match[1]);
  const p = profile(ctx); p.cooldownMinutes = minutes;
  for (const rule of p.alerts) rule.cooldownMinutes = minutes;
  await ctx.editMessageText(`Your alert cooldown is set to ${minutes} minutes.`, { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) });
});
export default composer;
