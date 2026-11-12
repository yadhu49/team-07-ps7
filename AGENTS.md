# AGENTS.md

RouteWise is the PS7 Delivery Dispatch Agent for the SRM Agentic AI hackathon (Team 07).
Everyone on the team and every AI tool works from these rules.

## The user and the problem

- Business user: a dispatcher at a city delivery hub.
- Logged-in user: dispatcher `D01`, Anitha V, Chennai hub.
- Today the dispatcher assigns deliveries by hand from a spreadsheet: riders get overloaded, riders are sent to the wrong area, and failed deliveries are forgotten.

## What the agent must do

Find pending deliveries by zone, pick riders who are on shift in the same zone with free capacity, assign the deliveries, and reschedule failed ones. The dispatcher asks in plain English.

## Business rules (also enforced in the database)

1. A delivery can be assigned only while its status is `pending`.
2. A rider can take deliveries only in their own `home_zone`.
3. A rider can take deliveries only on a day that has a `rider_shifts` row.
4. A rider can hold at most `riders.capacity` active deliveries (`assigned` or `out_for_delivery`).
5. A delivery can have at most 3 attempts.

`assign_delivery()` and `reschedule_delivery()` in `seed/ps7_delivery_dispatch.sql` check all of them.
Never update `deliveries`, `riders` or `rider_shifts` directly from TypeScript. Use the functions.

## File map

```
app/page.tsx                 Dispatch chat screen
app/board/page.tsx           Deliveries board (5 statuses)
app/riders/page.tsx          Riders with load
app/rider/page.tsx           Rider view: mark delivered/failed, COD totals
app/api/agent/route.ts       POST /api/agent - runs the agent
app/api/board/route.ts       GET /api/board - deliveries + riders for the screens
app/api/rider/route.ts       GET rider summaries + COD; POST mark delivered/failed
app/api/health/route.ts      Which settings are missing, and is the deliveries table there
components/AgentChat.tsx     Chat + tool call cards
components/DeliveriesBoard.tsx
components/RidersPanel.tsx
components/AppHeader.tsx
lib/agent/tools.ts           THE SIX TOOLS (main work)
lib/agent/systemPrompt.ts    Gemini's instructions
lib/agent/runAgent.ts        Agent loop, max 8 rounds
lib/agent/defineTool.ts      Zod -> Gemini function declarations
lib/supabase.ts              Server-only Supabase client (secret key)
lib/types.ts                 DTOs shared by the API and the screens
proxy.ts                     Passcode gate
seed/ps7_delivery_dispatch.sql  Tables, seed data, DB functions
```

## Conventions

- TypeScript and Tailwind CSS only. No new state libraries.
- Server-only code lives under `lib/` and `app/api/`. The secret key never reaches the browser.
- Every tool argument is validated with Zod in `defineTool` + `runAgent`.
- Tool descriptions start with "Use this when ..." so Gemini picks them correctly.
- Tool results are small objects. Errors are thrown as `new Error("plain English message")`.
- Dates are `YYYY-MM-DD`; times of day are `morning`, `afternoon`, `evening`.

## Demo prompts

- `Assign all pending Velachery deliveries for this evening.`
- `Which riders still have free capacity today?`
- `Reschedule yesterday's failed deliveries to tomorrow morning.`

## Done means

- `npm run build` passes.
- A prompt makes the agent call at least two tools, one of which writes, and the board changes on screen.
- No keys anywhere in git.
