import { useEffect, useState } from "react";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import LastUpdated from "../components/LastUpdated";
import type { TournamentDoc, PlayerDoc, PlayerMatchFact, TierMap } from "../types";

// We define a local type for the aggregated tournament stats
type TournamentStat = {
  wins: number;
  losses: number;
  halves: number;
};

export default function Teams() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentDoc | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerDoc>>({});
  const [stats, setStats] = useState<Record<string, TournamentStat>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch Active Tournament
        const tSnap = await getDocs(query(collection(db, "tournaments"), where("active", "==", true)));
        if (tSnap.empty) { setLoading(false); return; }
        const tData = { id: tSnap.docs[0].id, ...tSnap.docs[0].data() } as TournamentDoc;
        setTournament(tData);

        // 2. Collect all Player IDs from Rosters
        const teamAIds = Object.values(tData.teamA.rosterByTier || {}).flat();
        const teamBIds = Object.values(tData.teamB.rosterByTier || {}).flat();
        const allIds = [...teamAIds, ...teamBIds];

        if (allIds.length === 0) { setLoading(false); return; }

        // 3. Fetch Players (chunked to avoid Firestore limit of 10)
        const pMap: Record<string, PlayerDoc> = {};
        const chunks = [];
        for (let i=0; i<allIds.length; i+=10) chunks.push(allIds.slice(i, i+10));
        
        for (const chunk of chunks) {
          const pSnap = await getDocs(query(collection(db, "players"), where(documentId(), "in", chunk)));
          pSnap.forEach(doc => { pMap[doc.id] = { id: doc.id, ...doc.data() } as PlayerDoc; });
        }
        setPlayers(pMap);

        // 4. Fetch Match Facts ONLY for this Tournament
        // This allows us to calculate the record specific to this event.
        const factsQuery = query(
          collection(db, "playerMatchFacts"), 
          where("tournamentId", "==", tData.id)
        );
        const fSnap = await getDocs(factsQuery);
        
        const sMap: Record<string, TournamentStat> = {};

        fSnap.forEach((doc) => {
          const f = doc.data() as PlayerMatchFact;
          const pid = f.playerId;
          
          // Initialize if not exists
          if (!sMap[pid]) sMap[pid] = { wins: 0, losses: 0, halves: 0 };

          // Aggregate
          if (f.outcome === "win") sMap[pid].wins++;
          else if (f.outcome === "loss") sMap[pid].losses++;
          else if (f.outcome === "halve") sMap[pid].halves++;
        });

        setStats(sMap);
      } catch (err) {
        console.error("Failed to load teams", err);
        setError("Something went wrong while loading teams. Please try again later.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderRoster = (teamName: string, teamColor: string, roster?: TierMap, handicaps?: Record<string, number>, logo?: string) => {
    if (!roster) return (
      <div className="card p-4 opacity-60">
        <div className="text-center text-slate-400">No roster defined.</div>
      </div>
    );

    // Sort tiers alphabetically (A, B, C...)
    const tiers = Object.keys(roster).sort();

    return (
      <div className="card" style={{ padding: 0, overflow: "hidden", borderTop: `4px solid ${teamColor}` }}>
        {/* Team Header */}
        <div className="bg-slate-50" style={{ padding: "12px 16px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: 12 }}>
          {logo && (
            <img 
              src={logo} 
              alt={teamName}
              style={{ width: 32, height: 32, objectFit: "contain" }}
            />
          )}
          <h2 style={{ fontSize: "1rem", color: teamColor, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {teamName}
          </h2>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column" }}>
          {tiers.map((tier) => {
            const pIds = roster[tier as keyof TierMap] || [];
            if (pIds.length === 0) return null;

            return (
              <div key={tier}>
                {/* Tier Label */}
                <div className="section-header">
                  Tier {tier}
                </div>

                {/* Player Rows */}
                {pIds.map(pid => {
                  const p = players[pid];
                  const s = stats[pid];
                  const name = p?.displayName || p?.username || "Unknown";
                  const hcp = handicaps?.[pid];
                  
                  return (
                    <div 
                      key={pid} 
                      className="flex justify-between items-center px-4 py-3 border-b border-slate-200 
                                 hover:bg-slate-50 transition-colors duration-150"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold">{name}</span>
                        {hcp != null && (
                          <span className="text-xs text-slate-500">({hcp})</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 font-mono">
                        {s ? `${s.wins}-${s.losses}-${s.halves}` : "0-0-0"}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="spinner-lg"></div>
    </div>
  );
  if (error) return (
    <div className="p-5 text-center text-red-600">
      <div className="text-2xl mb-2">⚠️</div>
      <div>{error}</div>
    </div>
  );

  return (
    <Layout title="Team Rosters" series={tournament?.series} showBack>
      <div style={{ padding: 16, display: "grid", gap: 24, maxWidth: 800, margin: "0 auto" }}>
        {/* Team A Card */}
        {renderRoster(
          tournament?.teamA?.name || "Team A", 
          tournament?.teamA?.color || "var(--team-a-default)", 
          tournament?.teamA?.rosterByTier,
          tournament?.teamA?.handicapByPlayer,
          tournament?.teamA?.logo
        )}

        {/* Team B Card */}
        {renderRoster(
          tournament?.teamB?.name || "Team B", 
          tournament?.teamB?.color || "var(--team-b-default)", 
          tournament?.teamB?.rosterByTier,
          tournament?.teamB?.handicapByPlayer,
          tournament?.teamB?.logo
        )}
        <LastUpdated />
      </div>
    </Layout>
  );
}