import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { TournamentDoc, RoundDoc } from "./types";

// Extended MatchDoc to support both List view AND Leaderboard math
type MatchDoc = {
  id: string;
  roundId: string;
  pointsValue?: number;
  result?: { winner?: "teamA" | "teamB" | "AS"; holesWonA?: number; holesWonB?: number };
  status?: { 
    leader?: "teamA" | "teamB" | null; 
    margin?: number; 
    thru?: number; 
    closed?: boolean; 
    dormie?: boolean;
  };
};

// Helper component for the greyed-out projected scores
function ScoreBlock({ final, proj, color }: { final: number; proj: number; color?: string }) {
  return (
    <span>
      <span style={{ color: color || "inherit" }}>{final}</span>
      {proj > 0 && (
        <span style={{ fontSize: "0.6em", color: "#999", marginLeft: 6, verticalAlign: "middle" }}>
          (+{proj})
        </span>
      )}
    </span>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<TournamentDoc | null>(null);
  const [rounds, setRounds] = useState<RoundDoc[]>([]);
  const [matchesByRound, setMatchesByRound] = useState<Record<string, MatchDoc[]>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1) Find active tournament
        const tSnap = await getDocs(query(collection(db, "tournaments"), where("active", "==", true), limit(1)));
        if (tSnap.empty) { setTournament(null); setRounds([]); setMatchesByRound({}); setLoading(false); return; }
        const t = { id: tSnap.docs[0].id, ...(tSnap.docs[0].data() as any) } as TournamentDoc;
        setTournament(t);

        // 2) Load rounds
        const rQuery = query(collection(db, "rounds"), where("tournamentId", "==", t.id));
        const rSnap = await getDocs(rQuery);
        let rds = rSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as RoundDoc));
        rds = rds.sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || a.id.localeCompare(b.id));
        setRounds(rds);

        // 3) Load matches (Parallel)
        const matchesPromises = rds.map(async (r) => {
          const mSnap = await getDocs(query(collection(db, "matches"), where("roundId", "==", r.id)));
          const matches = mSnap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) } as MatchDoc))
            .sort((a, b) => a.id.localeCompare(b.id));
          return { roundId: r.id, matches };
        });

        const results = await Promise.all(matchesPromises);
        const bucket: Record<string, MatchDoc[]> = {};
        results.forEach((res) => { bucket[res.roundId] = res.matches; });
        setMatchesByRound(bucket);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- Leaderboard Calculation ---
  const stats = useMemo(() => {
    let fA = 0, fB = 0; // Finalized
    let pA = 0, pB = 0; // Projected (In-Progress)

    const allMatches = Object.values(matchesByRound).flat();

    for (const m of allMatches) {
      const pv = m.pointsValue ?? 1;
      const w = m.result?.winner; // calculated live by backend
      
      // Points if this match ended right now
      const ptsA = w === "teamA" ? pv : w === "AS" ? pv / 2 : 0;
      const ptsB = w === "teamB" ? pv : w === "AS" ? pv / 2 : 0;

      const isClosed = m.status?.closed === true;
      const isStarted = (m.status?.thru ?? 0) > 0;

      if (isClosed) {
        fA += ptsA;
        fB += ptsB;
      } else if (isStarted) {
        pA += ptsA;
        pB += ptsB;
      }
    }
    return { fA, fB, pA, pB };
  }, [matchesByRound]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!tournament) return <div style={{ padding: 16 }}>No active tournament found.</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 24 }}>
      
      {/* --- LEADERBOARD SECTION --- */}
      <section>
        <h1 style={{ marginTop: 0, marginBottom: 12, fontSize: "1.8rem" }}>{tournament.name}</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Team A Box */}
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, textAlign: "center", background: "#fafafa" }}>
            <div style={{ fontWeight: 700, color: tournament.teamA?.color || "#333", marginBottom: 4 }}>
              {tournament.teamA?.name || "Team A"}
            </div>
            <div style={{ fontSize: 32, fontWeight: "bold", lineHeight: 1 }}>
              <ScoreBlock final={stats.fA} proj={stats.pA} color={tournament.teamA?.color} />
            </div>
          </div>

          {/* Team B Box */}
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, textAlign: "center", background: "#fafafa" }}>
            <div style={{ fontWeight: 700, color: tournament.teamB?.color || "#333", marginBottom: 4 }}>
              {tournament.teamB?.name || "Team B"}
            </div>
            <div style={{ fontSize: 32, fontWeight: "bold", lineHeight: 1 }}>
              <ScoreBlock final={stats.fB} proj={stats.pB} color={tournament.teamB?.color} />
            </div>
          </div>
        </div>
      </section>

      {/* --- MATCHES LIST SECTION --- */}
      <section style={{ display: "grid", gap: 16 }}>
        {rounds.map((r, idx) => {
          const matches = matchesByRound[r.id] ?? [];
          return (
            <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>
                  Round {idx + 1} <span style={{fontWeight: 400, opacity: 0.7}}>• {r.format}</span>
                </h3>
              </div>

              {matches.length === 0 ? (
                <div style={{ padding: "8px 0", fontStyle: "italic", opacity: 0.6 }}>No matches.</div>
              ) : (
                <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
                  {matches.map((m) => (
                    <li key={m.id} style={{ padding: "8px 0", borderTop: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Link to={`/match/${m.id}`} style={{ textDecoration: "none", fontWeight: 500 }}>
                        Match {m.id}
                      </Link>
                      <span style={{ fontSize: "0.9em", opacity: 0.8 }}>
                        {m.status?.leader 
                          ? `${m.status.leader === "teamA" ? (tournament.teamA.name || "Team A") : (tournament.teamB.name || "Team B")} ${m.status.margin}`
                          : (m.status?.thru ?? 0) > 0 ? "AS" : "—"
                        } 
                        <span style={{ opacity: 0.6, marginLeft: 6, fontSize: "0.85em" }}>
                          {m.status?.closed ? "(F)" : (m.status?.thru ?? 0) > 0 ? `(${m.status?.thru})` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}