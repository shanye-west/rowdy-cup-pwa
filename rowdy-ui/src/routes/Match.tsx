import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc,
  onSnapshot,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  where,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TournamentDoc, PlayerDoc, MatchDoc, RoundDoc, RoundFormat } from "../types";
import { formatMatchStatus } from "../utils";

// Helper component for Handicap Dots
function Dots({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <span style={{ 
      color: "#ef4444", 
      fontSize: "1.2em", 
      lineHeight: 0, 
      position: "absolute", 
      top: 4, 
      right: 4,
      pointerEvents: "none" 
    }}>
      {"•".repeat(count)}
    </span>
  );
}

export default function Match() {
  const { matchId } = useParams();
  const [match, setMatch] = useState<MatchDoc | null>(null);
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [tournament, setTournament] = useState<TournamentDoc | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerDoc>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);

    // Listen to the MATCH
    const unsubMatch = onSnapshot(doc(db, "matches", matchId), async (mSnap) => {
      if (!mSnap.exists()) { setMatch(null); setLoading(false); return; }
      const m = { id: mSnap.id, ...(mSnap.data() as any) } as MatchDoc;
      setMatch(m);

      // Fetch static data (Tournament/Players) only once if needed
      // But we need to LISTEN to the Round to get the live "locked" status
      if (m.roundId) {
        // We set up a secondary listener for the Round
        // FIXED: Removed 'const unsubRound =' to silence unused variable error
        onSnapshot(doc(db, "rounds", m.roundId), async (rSnap) => {
            if (rSnap.exists()) {
                const r = { id: rSnap.id, ...(rSnap.data() as any) } as RoundDoc;
                setRound(r);
                
                // Fetch Tournament once (static)
                const tId = r.tournamentId || m.tournamentId;
                if (tId && !tournament) { // Check !tournament to avoid infinite loops/refetches
                    const tSnap = await getDoc(doc(db, "tournaments", tId));
                    if (tSnap.exists()) {
                        setTournament({ id: tSnap.id, ...(tSnap.data() as any) } as TournamentDoc);
                    }
                }
            }
        });
      }

      // Fetch Players (Static)
      const ids = Array.from(new Set([
        ...(m.teamAPlayers || []).map((p) => p.playerId).filter(Boolean),
        ...(m.teamBPlayers || []).map((p) => p.playerId).filter(Boolean),
      ]));
      
      if (ids.length) {
        // Check if we already have these players to avoid spamming reads
        const missing = ids.filter(id => !players[id]);
        if (missing.length > 0) {
            const qPlayers = query(collection(db, "players"), where("__name__", "in", ids));
            const pSnap = await getDocs(qPlayers);
            const map = { ...players };
            pSnap.forEach((d) => { map[d.id] = { id: d.id, ...(d.data() as any) }; });
            setPlayers(map);
        }
      }
      setLoading(false);
    });

    return () => unsubMatch();
  }, [matchId]); // Note: We rely on the internal logic to fetch Round/Players

  const format: RoundFormat = (round?.format as RoundFormat) || "twoManBestBall";
  
  // --- LOCK LOGIC ---
  // 1. Round Lock (Master Override)
  const roundLocked = !!round?.locked;
  // 2. Match Closed (Soft Lock)
  const isMatchClosed = !!match?.status?.closed;
  const matchThru = match?.status?.thru ?? 0;

  const holes = useMemo(() => {
    const h = match?.holes || {};
    return Array.from({ length: 18 }, (_, i) => String(i + 1)).map((k) => ({
      k,
      input: h[k]?.input || {},
    }));
  }, [match]);

  function nameFor(id?: string) {
    if (!id) return "";
    const p = players[id];
    return (p?.displayName as string) || (p?.username as string) || id;
  }

  async function saveHole(k: string, nextInput: any) {
    if (!match?.id || roundLocked) return; // Hard block if round is locked
    
    try {
      await updateDoc(doc(db, "matches", match.id), { [`holes.${k}.input`]: nextInput });
    } catch (e) {
      console.error("updateDoc failed", e);
      alert("Failed to save score");
    }
  }

  function HoleRow({ k, input }: { k: string; input: any }) {
    const holeIdx = Number(k) - 1;
    const holeNum = Number(k);

    // Lock if: Round is Locked OR (Match is Closed AND hole is past the finish)
    const isHoleLocked = roundLocked || (isMatchClosed && holeNum > matchThru);

    const getStrokes = (team: "A" | "B", pIdx: number) => {
      const roster = team === "A" ? match?.teamAPlayers : match?.teamBPlayers;
      return roster?.[pIdx]?.strokesReceived?.[holeIdx] ?? 0;
    };

    const inputStyle = {
      width: "100%", 
      padding: "10px 4px", 
      textAlign: "center" as const, 
      fontSize: "1.1em",
      borderRadius: 4,
      border: "1px solid #ccc",
      backgroundColor: isHoleLocked ? "#f3f4f6" : "white",
      color: isHoleLocked ? "#9ca3af" : "inherit"
    };

    if (format === "twoManScramble") {
      const a = input?.teamAGross ?? null;
      const b = input?.teamBGross ?? null;
      
      return (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <div style={{ textAlign: "center", fontWeight: "bold", color: "#888" }}>{k}</div>
          <div style={{ position: "relative" }}>
            <input type="number" inputMode="numeric" value={a ?? ""} disabled={isHoleLocked} style={inputStyle}
              onChange={(e) => saveHole(k, { teamAGross: e.target.value === "" ? null : Number(e.target.value), teamBGross: b })}
            />
          </div>
          <div style={{ position: "relative" }}>
            <input type="number" inputMode="numeric" value={b ?? ""} disabled={isHoleLocked} style={inputStyle}
              onChange={(e) => saveHole(k, { teamAGross: a, teamBGross: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
        </div>
      );
    }

    if (format === "singles") {
      const a = input?.teamAPlayerGross ?? null;
      const b = input?.teamBPlayerGross ?? null;
      const sA = getStrokes("A", 0);
      const sB = getStrokes("B", 0);

      return (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <div style={{ textAlign: "center", fontWeight: "bold", color: "#888" }}>{k}</div>
          <div style={{ position: "relative" }}>
            <input type="number" inputMode="numeric" value={a ?? ""} disabled={isHoleLocked} style={inputStyle}
              onChange={(e) => saveHole(k, { teamAPlayerGross: e.target.value === "" ? null : Number(e.target.value), teamBPlayerGross: b })}
            />
            <Dots count={sA} />
          </div>
          <div style={{ position: "relative" }}>
            <input type="number" inputMode="numeric" value={b ?? ""} disabled={isHoleLocked} style={inputStyle}
              onChange={(e) => saveHole(k, { teamAPlayerGross: a, teamBPlayerGross: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <Dots count={sB} />
          </div>
        </div>
      );
    }

    // Best Ball / Shamble
    const aArr = Array.isArray(input?.teamAPlayersGross) ? input.teamAPlayersGross : [null, null];
    const bArr = Array.isArray(input?.teamBPlayersGross) ? input.teamBPlayersGross : [null, null];

    return (
      <div key={k} style={{ display: "grid", gridTemplateColumns: "30px repeat(4, 1fr)", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <div style={{ textAlign: "center", fontWeight: "bold", color: "#888", fontSize: "0.9em" }}>{k}</div>
        <div style={{ position: "relative" }}>
          <input type="number" inputMode="numeric" value={aArr[0] ?? ""} disabled={isHoleLocked} style={inputStyle}
            onChange={(e) => { const n = [...aArr]; n[0] = e.target.value === "" ? null : Number(e.target.value); saveHole(k, { teamAPlayersGross: n, teamBPlayersGross: bArr }); }} 
          />
          <Dots count={getStrokes("A", 0)} />
        </div>
        <div style={{ position: "relative" }}>
          <input type="number" inputMode="numeric" value={aArr[1] ?? ""} disabled={isHoleLocked} style={inputStyle}
            onChange={(e) => { const n = [...aArr]; n[1] = e.target.value === "" ? null : Number(e.target.value); saveHole(k, { teamAPlayersGross: n, teamBPlayersGross: bArr }); }} 
          />
          <Dots count={getStrokes("A", 1)} />
        </div>
        <div style={{ position: "relative" }}>
          <input type="number" inputMode="numeric" value={bArr[0] ?? ""} disabled={isHoleLocked} style={inputStyle}
            onChange={(e) => { const n = [...bArr]; n[0] = e.target.value === "" ? null : Number(e.target.value); saveHole(k, { teamAPlayersGross: aArr, teamBPlayersGross: n }); }} 
          />
          <Dots count={getStrokes("B", 0)} />
        </div>
        <div style={{ position: "relative" }}>
          <input type="number" inputMode="numeric" value={bArr[1] ?? ""} disabled={isHoleLocked} style={inputStyle}
            onChange={(e) => { const n = [...bArr]; n[1] = e.target.value === "" ? null : Number(e.target.value); saveHole(k, { teamAPlayersGross: aArr, teamBPlayersGross: n }); }} 
          />
          <Dots count={getStrokes("B", 1)} />
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!match) return <div style={{ padding: 16 }}>Match not found.</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 16, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {match.roundId && (
              <Link to={`/round/${match.roundId}`} style={{ textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
            )}
            <h2 style={{ margin: 0 }}>Match {match.id}</h2>
          </div>
          
          {/* Visual indicator ONLY (no button) */}
          {roundLocked && (
            <div style={{background:'#fee2e2', color:'#b91c1c', fontSize:'0.8rem', padding:'4px 8px', borderRadius:4, fontWeight:'bold'}}>
              LOCKED
            </div>
          )}
        </div>
        <div style={{ fontSize: "0.9em", opacity: 0.7, marginLeft: 24 }}>
          {format} {tournament && `• ${tournament.name}`}
        </div>
      </div>

      {/* Status Card */}
      <div style={{ background: (isMatchClosed || roundLocked) ? "#fff1f2" : "#f8fafc", border: "1px solid #e2e8f0", padding: 16, borderRadius: 8, textAlign: "center" }}>
        <div style={{ fontSize: "1.2em", fontWeight: "bold", marginBottom: 4 }}>
          {formatMatchStatus(match.status, tournament?.teamA?.name, tournament?.teamB?.name)}
        </div>
        <div style={{ fontSize: "0.9em", opacity: 0.7 }}>
          {/* FIXED: Added optional chaining below to fix TS error */}
          {match.status?.closed 
            ? "Final Result" 
            : (match.status?.thru ?? 0) > 0 ? `Thru ${match.status?.thru}` : "Not started"}
        </div>
      </div>

      {/* Player Names & Score Grid... (Rest of file is unchanged) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.9em" }}>
        <div style={{ borderTop: `3px solid ${tournament?.teamA?.color || "#ccc"}`, paddingTop: 4 }}>
          <div style={{ fontWeight: 700 }}>{tournament?.teamA?.name || "Team A"}</div>
          <div style={{ opacity: 0.8 }}>{(match.teamAPlayers || []).map(p => nameFor(p.playerId)).filter(Boolean).join(", ")}</div>
        </div>
        <div style={{ borderTop: `3px solid ${tournament?.teamB?.color || "#ccc"}`, paddingTop: 4 }}>
          <div style={{ fontWeight: 700 }}>{tournament?.teamB?.name || "Team B"}</div>
          <div style={{ opacity: 0.8 }}>{(match.teamBPlayers || []).map(p => nameFor(p.playerId)).filter(Boolean).join(", ")}</div>
        </div>
      </div>

      <div>
        {format !== "singles" && format !== "twoManScramble" && (
          <div style={{ display: "grid", gridTemplateColumns: "30px repeat(4, 1fr)", gap: 6, textAlign: "center", fontSize: "0.75em", fontWeight: 600, opacity: 0.6, marginBottom: 8 }}>
            <div>#</div>
            <div>{tournament?.teamA?.name ? "A1" : "P1"}</div>
            <div>{tournament?.teamA?.name ? "A2" : "P2"}</div>
            <div>{tournament?.teamB?.name ? "B1" : "P1"}</div>
            <div>{tournament?.teamB?.name ? "B2" : "P2"}</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {holes.map((h) => (
            <HoleRow key={h.k} k={h.k} input={h.input} />
          ))}
        </div>
      </div>
    </div>
  );
}