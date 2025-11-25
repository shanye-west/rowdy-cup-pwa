What the app is

A mobile-first Progressive Web App for a 12v12 Ryder-Cup–style golf tournament. Admins seed all setup data in Firestore (no admin UI). Players only enter gross scores per hole during play. Cloud Functions compute net, hole winners, match status, and results in real time. The public can view everything read-only (match pages, leaderboard, roster).

If you want the longer spec you drafted earlier, it’s here: /mnt/data/Golf Tournament PWA - Project Blueprint (Final MVP).docx
And the current “compute & stats” contract lives here (latest): Golf Pwa — Compute & Stats Contract V1 (Canvas)

Who uses it

Players: enter hole scores on phones; see live match status.

Spectators: read-only live matches, leaderboard, roster by tier.

Admin (pre-event only): seeds tournaments, rounds, matches, players, handicaps; may lock/unlock a match.

Core behavior

Multiple tournaments stored; exactly one active=true live at a time; others are read-only history.

Rounds own the format; matches inherit it (no per-match overrides).

Formats supported: Singles, Two-man Best Ball, Two-man Shamble (gross entry; scoring like best ball), Two-man Scramble.

Matches are auto-templated with 18 holes and format-specific inputs on create.

Handicaps are pre-seeded as per-player strokesReceived arrays (length 18, each 0 or 1). Course handicaps capped at 18, so never >1 stroke per hole.

Players type gross numbers only:

Singles: one gross per side.

Best Ball/Shamble: two gross inputs per side.

Scramble: one team gross per side.

Net calculation = gross − strokesReceived[holeIndex].

Hole winners:

Scramble: team gross vs team gross.

Best Ball/Shamble: side score = min(player net); lower wins; equal = AS.

Singles: player net vs player net.

Match status/result:

Win = full pointsValue; halve (AS) = half; loss = 0.

Early closure when lead > holes remaining → closed=true; “dormie” when lead == holes remaining.

End of 18 tied → AS; each gets half points.

Editing earlier holes can reopen a closed match if the math changes.

Player Tier tracking per tournament (A/B/C/D) for roster display and lifetime stats “by tier.”

Head-to-head counts include team formats as agreed.

Data (Firestore, simplified)

tournaments/{id}: { active, name, teamA:{ id,name,color, rosterByTier:{A:[],B:[],C:[],D:[]} }, teamB:{...}, roundIds[] }

players/{id}: { displayName?, username? }

rounds/{id}: { tournamentId, day, format, course:{ name, holes:[{number,par,hcpIndex}] }, matchIds[] }

matches/{id}:

Setup: { tournamentId, roundId, pointsValue, teamAPlayers:[{playerId,strokesReceived:number[18]}], teamBPlayers:[...] }

Inputs per hole:

Singles: { teamAPlayerGross?, teamBPlayerGross? }

Best Ball/Shamble: { teamAPlayersGross:[n|null,n|null], teamBPlayersGross:[n|null,n|null] }

Scramble: { teamAGross?, teamBGross? }

Computed: status:{ leader|null, margin, thru, dormie, closed }, result:{ winner|'AS', holesWonA, holesWonB }

Security (development → production)

Dev: public read; any authenticated (anonymous) user can update matches.

Production tightening: only allow writes to matches/{id}.holes.*.input.*. Deny writes to status, result, rosters, or setup fields. Optional: restrict writers to rostered players or admin; lock when closed.

Tech stack

Firebase: Firestore, Cloud Functions (Gen-2), Auth (Anonymous), Hosting.

Frontend: Vite + React (TypeScript), PWA-ready.

Live updates: Firestore onSnapshot on match docs.

What you want long-term

Simple, reliable scoring for all formats with minimal UI.

Read-only public access; phones show live status.

Full historical stats:

Per-player lifetime and per-tournament records.

Head-to-head totals (team formats count).

Records by match type and by Tier (A/B/C/D).

No in-app admin; all seeding via Firestore UI; templates/defaults reduce data entry.

Step-by-step plan
Phase 1 — Core UX (now)

Lock dev rules to “holes-only” writes (keep public read).

Match page:

Live subscription, format-specific inputs.

Team names/colors, player names.

Inputs disabled when status.closed.

Stroke badges per hole (visual check of strokesReceived).

Leaderboard route (/leaderboard): sum points from result by team and by round.

Roster route (/roster): list Tier A/B/C/D per team from rosterByTier.

Hosting deploy. Verify on phones.

Phase 2 — Stats engine

Cloud Function updatePlayerStatsOnMatch:

On matches/{id} write, if result changed, upsert immutable playerMatchFacts for each rostered player with an outcome signature.

Apply idempotent increments to playerStats (lifetime, by type, by tournament) and headToHead (lifetime/by type/by tournament).

Player page (/player/:playerId): show lifetime record, per-type splits, head-to-head, by-tier slices.

Phase 3 — Admin conveniences (optional)

In-UI Lock/Unlock control (admin-only) to toggle status.closed.

Seed validator script (Node/TS) to sanity-check Firestore docs before events:

Valid strokes arrays; hole keys “1”..“18”; players exist; format present; pointsValue>0.

Tighten rules to rostered-player writes only; add admin bypass.

Phase 4 — PWA polish

vite-plugin-pwa manifest + icons; registerType:'autoUpdate'.

Offline read caching verification; install banners.