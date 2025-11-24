# Rowdy PWA — Product & Implementation Plan (v1)

## 1) Purpose & Vision

Rowdy PWA is a lightweight, mobile‑first Progressive Web App used on-course to score a Ryder Cup–style tournament. Admins seed all setup in Firestore before play (players, teams, rounds, courses, matches, handicaps). Players only enter gross scores per hole; the backend enforces handicaps and computes match status, results, and team points in real time. The app serves spectators with read‑only live views (leaderboard, matches, roster) and provides a minimal input UI for players.

**Non‑goals (current MVP):** No admin UI for seeding; no user management beyond anonymous auth; no payment; no complex analytics UX (stats are computed/stored for later views).

---

## 2) Users & Scenarios

* **Players:** Enter per‑hole gross scores on their phone. See live match status.
* **Spectators:** Read‑only live scoreboard, per‑match views, and roster by tier.
* **Admin (pre‑event):** Seeds all data directly in Firestore UI. Can lock/unlock matches in the console (optional UI toggle later).

---

## 3) Functional Requirements (MVP)

1. **Tournaments**: Store many; exactly one active at a time (read‑only history for others).
2. **Rounds**: Each round sets format (singles, best ball, shamble, scramble). All matches in the round inherit this.
3. **Matches**: Auto‑templated holes (1–18) on creation. Real‑time compute updates status/result.
4. **Handicaps**: Max 1 stroke per hole, pre‑seeded per player per match (arrays of length 18 with values 0/1). Net = gross − stroke.
5. **Scoring**: Win = full points, Halve = half points, Loss = 0. Early closure when lead > holes remaining; dormie flag when lead == holes remaining.
6. **Inputs**: Players enter only `holes.*.input.*` values; app computes everything else.
7. **Edits**: Prior holes may be edited to correct mistakes; compute may reopen a previously closed match.
8. **Stats (Phase 2)**: Persist per‑player match facts, lifetime and per‑tournament rollups, and head‑to‑head counters. Team formats count toward head‑to‑head as agreed.

---

## 4) Data Model (Firestore)

**Collections**

* `tournaments/{id}`: `{ active, name, series, teamA:{ id,name,color,rosterIds }, teamB:{ ... }, roundIds[], settings? }`
* `players/{id}`: `{ username, displayName?, nickname?, handicapIndex?, bio?, stats? }`
* `rounds/{id}`: `{ tournamentId, day, format: "singles"|"twoManBestBall"|"twoManShamble"|"twoManScramble", course:{ name, tees?, holes:[{ number, par, hcpIndex }] }, matchIds[] }`
* `matches/{id}`: `{ tournamentId, roundId, pointsValue, teamAPlayers:[{ playerId, strokesReceived:number[18] }], teamBPlayers:[{ ... }], holes:{ "1":{ input:{ ... } }, ... }, status:{ leader|null, margin, thru, dormie, closed }, result:{ winner|"AS", holesWonA, holesWonB } }`

**Holes.input shape**

* **Singles**: `{ teamAPlayerGross?: number, teamBPlayerGross?: number }`
* **Best Ball / Shamble**: `{ teamAPlayersGross?: (number|null)[], teamBPlayersGross?: (number|null)[] }` (arrays length 2)
* **Scramble**: `{ teamAGross?: number, teamBGross?: number }`

---

## 5) Deterministic Compute (Cloud Functions)

**Evaluation**

* **Net**: `net = gross − strokesReceived[i]` (0/1 only; cap enforced by seeding).
* **Hole winner**:

  * Scramble: lower team gross wins; equal = AS.
  * Best Ball/Shamble: side score is `min(playerNet[])`; lower wins; equal = AS.
  * Singles: lower net wins; equal = AS.
* **Match status**: track holes won A/B, compute `leader`, `margin`, `thru`, `dormie`, `closed`. End of 18 with tie → `winner="AS"` and half points.
* **Reopen**: Editing prior holes recomputes and may clear `closed`.

**Triggers**

* `seedMatchBoilerplate` (on create `matches/{id}`): ensure `status` exists, create holes per format, pad/trim per‑side player arrays (2 for team formats, 1 for singles), append matchId to parent round.
* `seedRoundDefaults` (on create `rounds/{id}`): initialize `matchIds: []` if missing.
* `linkRoundToTournament` (on write `rounds/{id}`): keep `tournaments/{id}.roundIds` in sync.
* `computeMatchOnWrite` (on write `matches/{id}`): if non‑compute fields changed, run summarizer and write `{status,result}` idempotently.
* *(Phase 2)* `updatePlayerStatsOnMatch`: when `result` changes, upsert immutable facts and rollups.

---

## 6) Security (dev→prod hardening path)

* **Dev rules (current):** Public read; authenticated users (anonymous ok) may update `matches`.
* **Next:** Restrict writes to `matches/{id}.holes.*.input.*` only; deny writes to `status/result` and setup fields.
* **Later:** Optional: lock writes when `status.closed==true` except earlier holes; restrict writers to rostered players or admins; add admin bypass.

---

## 7) Frontend (Vite + React + Firebase)

* **Routes**

  * `/`: Active tournament → rounds → matches list (links).
  * `/match/:matchId`: Live scorecard; per‑format inputs; disabled when `closed`.
  * `/leaderboard`: Team points totals and by‑round breakdown.
  * *(Planned)* `/roster`: Roster by tier; `/player/:playerId`: player profile & stats.

* **Behavior**

  * Initialize Firebase app; sign in anonymously on load.
  * Use Firestore `onSnapshot` for live match updates.
  * Inputs write only to `holes.<n>.input` paths; compute function updates status/result.
  * Header shows team names/colors and player names fetched from tournament/players collections.

* **PWA**

  * Add `vite-plugin-pwa` with `registerType:'autoUpdate'`; supply icons and manifest later.

---

## 8) Infrastructure & DevOps

* **Hosting**: Firebase Hosting serves `rowdy-ui/dist` with SPA rewrite to `/index.html`.
* **Auth**: Anonymous enabled (players get `request.auth != null`).
* **CI/CD (optional)**: GitHub Action for Hosting to auto‑deploy on `main` push.
* **Environments**: Single project for MVP; emulator setup optional for local dev.

---

## 9) Step‑by‑Step Implementation Plan

### Phase 0 — Foundation (done)

1. Create Firebase project `rowdy-pwa`; enable Firestore + Auth (Anonymous).
2. Initialize Functions (`functions/`) and Web (`rowdy-ui/`) with Vite React TS.
3. Seed initial data in Firestore UI: players, tournament, rounds, courses, matches.
4. Implement compute functions and deploy.
5. Build minimal `/match/:matchId` with live updates; public read rules; dev writes open.

### Phase 1 — Core UX (current)

1. **Home list**: `/` lists rounds & matches for active tournament.
2. **Match page polish**: show team colors/names, player names, disable on `closed`, show stroke badges per hole.
3. **Leaderboard**: `/leaderboard` sums points from `result`.
4. **Security tightening**: deploy rules to allow only `holes.*.input.*` writes.
5. **Hosting deploy** for public access.

### Phase 2 — Stats Engine

1. **Facts writer** (`updatePlayerStatsOnMatch`): On `result` change, upsert `playerMatchFacts/{matchId}_{playerId}` with outcome signature and points.
2. **Rollups**: Increment `playerStats/{playerId}` lifetime, by type, and by tournament. Update `headToHead` docs for all opponent pairings.
3. **Idempotency**: Use outcome signature to compute deltas safely.
4. **Player page** (`/player/:id`) reads stats and lists recent facts.

### Phase 3 — Roster & Tiers View

1. **Roster page** (`/roster`): Group players by Tier (A/B/C/D) pulled from tournament’s `rosterByTier`.
2. **Tier stats**: Show each player’s lifetime record **by tier** (from `playerStats`).

### Phase 4 — Admin & Quality

1. **Lock/Unlock control**: Simple toggle (admin‑only) to set `status.closed` in the UI.
2. **Indexes**: Add Firestore indexes only if queries require them.
3. **Validator script**: Node/TS script to validate seed docs and simulate compute (pre‑event sanity check).
4. **Offline**: Verify PWA install and offline read caching.

---

## 10) Testing Checklist (MVP)

* Singles tie through 18 → `AS`, half points; `thru=18`, `leader=null`.
* Stroke decides a best ball hole; equal gross with one stroke → correct side wins.
* Early closure math (e.g., 3‑up with 2 to play) sets `closed=true`.
* Edit an earlier hole after closure → recompute and reopen if needed.
* Inputs only affect `holes.*.input.*`; status/result are function‑maintained.
* Public visitors can read; authenticated clients can write inputs.

---

## 11) Future Enhancements (post‑MVP)

* Per‑hole UI affordances (tap‑to‑AS, quick +/− controls).
* Match list filters (ongoing/final) and course info panel (par, handicap).
* Admin seed helpers (CSV import) and bulk templates.
* Email/password or OAuth for admins.
* Live notifications when matches go dormie/close.

---

## 12) Definition of Done (MVP)

* All data seeded for an event; app hosted and reachable on mobile.
* Players can enter scores from phones; compute is correct across formats.
* Leaderboard displays team totals; match pages reflect live status changes.
* Rules enforce read‑only for public and limit writes to hole inputs.
* Smoke tests of the checklist pass on real data.

## 13) Lasted updated at 8:46pm on Sunday, November 23, 2025