# Crypto Watcher Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that tracks cryptocurrency prices, sends customizable alerts for price thresholds/percent moves, and provides on-demand price checks with optional morning summaries. Features include quiet hours, cooldown suppression, and owner analytics for total users and top alerting rules.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto investors
- price alert subscribers

## Success criteria

- users receive accurate price alerts within 10 minutes of threshold crossing
- 95% of price check requests return valid data within 2 seconds
- morning summaries delivered at user's local scheduled time ±5 minutes

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open onboarding menu and main controls
- **Add suggested coin** (button, actor: user, callback: watchlist:add_suggested) — Add Bitcoin/Ethereum/Toncoin to watchlist
  - inputs: coin symbol
  - outputs: updated watchlist
- **Create alert** (button, actor: user, callback: alert:create) — Configure price threshold or percent move alert
  - inputs: alert type, coin, direction, value
  - outputs: confirmation message
- **/price** (command, actor: user, command: /price) — Check current price of specified coin or full watchlist
  - inputs: optional ticker symbol
  - outputs: price data
- **Manage alerts** (button, actor: user, callback: alert:manage) — View/edit active alerts and cooldowns
  - inputs: alert ID
  - outputs: alert status

## Flows

### onboarding
_Trigger:_ /start

1. welcome message
2. coin selection
3. cooldown confirmation

_Data touched:_ user profile

### alert creation
_Trigger:_ alert:create

1. select alert type
2. choose coin
3. set direction/value
4. confirm rule

_Data touched:_ alert rule

### price check
_Trigger:_ /price

1. parse ticker parameter
2. fetch current price
3. format response

_Data touched:_ watchlist item

### morning summary
_Trigger:_ scheduled event

1. collect user data
2. generate price summary
3. send formatted message

_Data touched:_ user profile

### alert suppression
_Trigger:_ price update event

1. check cooldown window
2. verify quiet hours
3. send alert if applicable

_Data touched:_ alert event

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user profile** _(retention: persistent)_ — User preferences and tracking data
  - fields: watchlist, alert rules, quiet hours, summary time, last alert timestamps
- **watchlist item** _(retention: persistent)_ — Tracked cryptocurrency ticker with user-defined name
  - fields: ticker symbol, display name
- **alert rule** _(retention: persistent)_ — Price alert configuration
  - fields: type, coin, direction, value, cooldown period
- **alert event** _(retention: session)_ — Triggered alert details
  - fields: coin, old price, new price, percent change, timestamp

## Integrations

- **Telegram** (required) — Bot API messaging and scheduled notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- View total active users
- See top 10 alerting coins/rules
- Receive error notifications for price feed failures

## Notifications

- Price threshold alerts
- Percent move alerts
- Morning summary digest
- Error notifications for price feed failures

## Permissions & privacy

- All user data encrypted at rest
- No third-party data sharing
- Private 1:1 chat interactions only

## Edge cases

- Unknown ticker fuzzy matching
- Price feed temporary failures
- Alert suppression during quiet hours
- Multiple rule triggers within cooldown window

## Required tests

- End-to-end alert suppression during cooldown
- Morning summary delivery at local time
- Quiet hours alert queuing and post-period delivery

## Assumptions

- Default 10-minute cooldown for alert suppression
- Morning summaries use user's local timezone
- Price feed failures trigger silent retries
