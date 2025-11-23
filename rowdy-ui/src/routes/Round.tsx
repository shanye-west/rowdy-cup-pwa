// src/routes/Round.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import type { RoundDoc, TournamentDoc } from "../types";

// Re-defining locally for convenience, or you can move this to types.ts
type MatchDoc = {
  id: string;
  roundId: string;
  pointsValue?: number;
  result?: { winner?: "teamA" | "teamB" | "AS" };
  status?: { 
    leader?: "teamA" | "teamB" | null; 
    margin?: number; 
    thru?: number; 
    closed?: boolean; 
  };
};

export default function Round() {
  const { roundId } = useParams();
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [tournament, setTournament] = useState<TournamentDoc | null>(null);
  const [matches, setMatches] = useState<MatchDoc[]>([]);

  useEffect(() => {
    if (!roundId) return;
    (async () => {
      setLoading(true);
      try {
        // 1. Fetch Round
        const rSnap = await getDoc(doc(db, "rounds", roundId));
        if (!rSnap.exists()) { setLoading(false); return; }
        const rData = { id: rSnap.id, ...rSnap.data() } as RoundDoc;
        setRound(rData);

        // 2. Fetch Tournament (for team names)
        if (rData.tournamentId) {
          const tSnap = await getDoc(doc(db, "tournaments", rData.tournamentId));
          if (tSnap.exists()) {
            setTournament({ id: tSnap.id, ...tSnap.data() } as TournamentDoc);
          }
        }

        // 3. Fetch Matches
        const q = query(collection(db, "matches"), where("roundId", "==", roundId));
        const mSnap = await getDocs(q);
        const ms = mSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as MatchDoc))
          .sort((a, b) => a.id.localeCompare(b.id));
        setMatches(ms);
      } finally {
        setLoading(false);
      }
    })();
  }, [roundId]);

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (!round) return <div style={{ padding: 16 }}>Round not found.</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Round {round.day ? round.day : ""}</h1>
        <Link to="/">Back to Home</Link>
      </div>
      <div style={{ opacity: 0.7, marginTop: -8 }}>{round.format}</div>

      {/* Matches List */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        {matches.length === 0 ? (
          <div style={{ padding: "8px 0", fontStyle: "italic", opacity: 0.6 }}>No matches seeded.</div>
        ) : (
          <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
            {matches.map((m) => (
              <li key={m.id} style={{ padding: "12px 0", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Link to={`/match/${m.id}`} style={{ textDecoration: "none", fontWeight: 500, fontSize: "1.1rem" }}>
                  Match {m.id}
                </Link>
                <span style={{ fontSize: "0.95em", opacity: 0.9 }}>
                  {m.status?.leader 
                    ? `${m.status.leader === "teamA" ? (tournament?.teamA.name || "Team A") : (tournament?.teamB.name || "Team B")} ${m.status.margin}`
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
    </div>
  );
}