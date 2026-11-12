# RouteWise: Delivery Dispatch Agent

Team `<number>` | PS7 | SRM Agentic AI Hackathon

## The problem

The dispatcher at a city delivery hub assigns every delivery to a rider by hand from a spreadsheet. Riders get overloaded while others sit idle, riders are sent to areas they do not cover, and failed deliveries are forgotten instead of being rescheduled.

Logged-in user: **dispatcher D01, Anitha V** (Chennai hub).

## What our app does

- The dispatcher asks in plain English and the agent does the dispatch work, not the spreadsheet.
- Finds pending deliveries by zone, date and time window.
- Picks riders who are active, on shift that day, in the same zone, with free capacity.
- Assigns deliveries through the database function `assign_delivery()`, which checks every business rule.
- Reschedules failed deliveries through `reschedule_delivery()`, with a hard limit of 3 attempts per delivery.
- Three screens: dispatch chat, deliveries board (Pending, Assigned, Out for delivery, Delivered, Failed) and riders with their live load.

## Live demo

- Vercel link: `<to fill after deploy>`
- Passcode: `<to fill after deploy>`
- Try this prompt: `Assign all pending Velachery deliveries for this evening.`

## Agent tools

| Tool | What it does | Reads or writes |
| --- | --- | --- |
| `getPendingDeliveries` | Pending deliveries for a date, filterable by zone and time window | Reads |
| `getAvailableRiders` | Active riders with a shift that day: zone, shift hours, load, free capacity | Reads |
| `getRiderLoad` | Every rider's active load, capacity, shift and deliveries completed today | Reads |
| `getFailedDeliveries` | Failed deliveries with attempts used and whether a retry is allowed | Reads |
| `assignDelivery` | Assigns one pending delivery to one rider via `assign_delivery()` | Writes |
| `rescheduleDelivery` | Moves a failed delivery to a new date and window via `reschedule_delivery()` | Writes |

Every tool argument is checked with **Zod** before the tool runs. Gemini never touches the database directly.

## Database tables

| Table | What it stores |
| --- | --- |
| `zones` | Chennai delivery zones and their pincodes |
| `riders` | Riders, home zone, vehicle, capacity, active flag |
| `rider_shifts` | One row per rider per day with shift start and end |
| `deliveries` | The delivery: order ref, customer, address, zone, parcel, COD, date, window, rider, status, attempts |
| `delivery_attempts` | Every attempt, outcome and note |

Database functions `assign_delivery(delivery_id, rider_id)` and `reschedule_delivery(delivery_id, new_date, time_window)` hold the rules: pending only, same zone, shift that day, capacity, max 3 attempts. RLS is on with no public policies, so only the server's secret key can read or write.

## Business rules

1. A delivery can be assigned only while its status is `pending`.
2. A rider can take deliveries only in their own zone.
3. A rider can take deliveries only on a day they have a shift.
4. A rider can hold at most their `capacity` of active deliveries (`assigned` or `out_for_delivery`).
5. A delivery can have at most 3 attempts; failed deliveries must be rescheduled before they can be assigned again.

## Screens

- `/` dispatch chat + live rider load
- `/board` deliveries board with the five statuses
- `/riders` riders, shifts and load

## Tech stack

Next.js (App Router), React, TypeScript, Tailwind CSS, Supabase PostgreSQL, Google Gemini API (function calling), Zod, Vercel.

## Team

| Name | Role |
| --- | --- |
| `<name>` | Team Lead |
| `<name>` | Frontend |
| `<name>` | Backend / API |
| `<name>` | Database |
| `<name>` | AI / Agent |

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_PASSCODE`.
3. In Supabase, SQL Editor, run `seed/ps7_delivery_dispatch.sql`.
4. `npm run dev` and open http://localhost:3000.
5. Open `/api/health` to check the settings and the tables.

## Deploy on Vercel

Import this repo on vercel.com, add the same five environment variables, deploy. Every push to `main` redeploys.

## Troubleshooting

- `Model not found`: set `GEMINI_MODEL=gemini-flash-latest` and redeploy.
- `relation "deliveries" does not exist`: run the seed SQL in Supabase.
- `Could not find the table ... in the schema cache`: make sure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` come from the same project, then reload the schema.
- Agent replies without calling a tool: check the tool descriptions and the system prompt.
