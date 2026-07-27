import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { currency, prices, profile, resolveCoin } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Check prices", data: "price:watchlist", order: 40 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, ticker?: string, edit = false): Promise<void> {
  const p = profile(ctx);
  let coins = p.watchlist;
  if (ticker) {
    try { const coin = await resolveCoin(ticker); if (!coin) return void await respond(ctx, `Couldn't find ${ticker.toUpperCase()}. Check the symbol and try again.`, edit); coins = [coin]; }
    catch { return void await respond(ctx, "The price feed is temporarily unavailable. Try again shortly.", edit); }
  }
  if (!coins.length) return void await respond(ctx, "Your watchlist is empty — add a coin to check its price.", edit);
  try {
    const quote = await prices(coins);
    const lines = coins.flatMap((coin) => quote[coin.id] ? [`${coin.name} (${coin.symbol}): ${currency(quote[coin.id].usd)} · ${quote[coin.id].change >= 0 ? "+" : ""}${quote[coin.id].change.toFixed(2)}% today`] : []);
    if (!lines.length) return void await respond(ctx, "I couldn't get a current price for that coin. Try again shortly.", edit);
    await respond(ctx, lines.join("\n"), edit);
  } catch { await respond(ctx, "The price feed is temporarily unavailable. Try again shortly.", edit); }
}
async function respond(ctx: Ctx, text: string, edit: boolean): Promise<void> {
  const options = { reply_markup: inlineKeyboard([[inlineButton("Check watchlist", "price:watchlist")], [inlineButton("Back to menu", "menu:main")]]) };
  if (edit) await ctx.editMessageText(text, options); else await ctx.reply(text, options);
}
composer.command("price", async (ctx) => {
  const ticker = ctx.message?.text?.split(/\s+/, 2)[1];
  await show(ctx, ticker);
});
composer.callbackQuery("price:watchlist", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, undefined, true); });
export default composer;
