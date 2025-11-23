// src/routes/Match.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

type RoundFormat = "twoManBestBall" | "twoManShamble" | "twoManScramble" | "singles";

type MatchDoc = {
  id: string;
  roundId: string;
  holes?: Record<string, any>;
  status?: {
    leader: "teamA" | "teamB" | null;
    margin: number;
    thru: number;
    dormie: boolean;
    closed: boolean;
  };
  teamAPlayers?: any[];
  teamBPlayers?: any[];
  pointsValue?: number;
};

type RoundDoc = {
  id: string;
  format: RoundFormat;
};

export default function Match() {
  const { matchId } = useParams();
  const [match, setMatch] = useState<MatchDoc | null>(null);
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // Live subscription to the match; fetch the round once per match update
  useEffect(() => {
    if (!matchId) return;
    setLoading(true);

    const unsub = onSnapshot(doc(db, "matches", matchId), async (mSnap) => {
      if (!mSnap.exists()) {
        setMatch(null);
        setLoading(false);
        return;
      }
      const m = { id: mSnap.id, ...(mSnap.data() as any) } as MatchDoc;
      setMatch(m);

      if (m.roundId) {
        const rSnap = await getDoc(doc(db, "rounds", m.roundId));
        if (rSnap.exists()) {
          const r = { id: rSnap.id, ...(rSnap.data() as any) } as RoundDoc;
          setRound(r);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [matchId]);

  const format: RoundFormat = (round?.format as RoundFormat) || "twoManBestBall";
  const isClosed = !!match?.status?.closed;

  const holes = useMemo(() => {
    const h = match?.holes || {};
    return Array.from({ length: 18 }, (_, i) => String(i + 1)).map((k) => ({
      k,
      input: h[k]?.input || {},
    }));
  }, [match]);

  async function saveHole(k: string, nextInput: any) {
    if (!match?.id || isClosed) return; // block writes if Final
    await updateDoc(doc(db, "matches", match.id), { [`holes.${k}.input`]: nextInput });
  }

  function HoleRow({ k, input }: { k: string; input: any }) {
    if (format === "twoManScramble") {
      const a = input?.teamAGross ?? null;
      const b = input?.teamBGross ?? null;
      return (
        <div
          key={k}
          style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 8, alignItems: "center" }}
        >
          <div>#{k}</div>
          <input
            type="number"
            inputMode="numeric"
            value={a ?? ""}
            disabled={isClosed}
            onChange={(e) =>
              saveHole(k, {
                teamAGross: e.target.value === "" ? null : Number(e.target.value),
                teamBGross: b,
              })
            }
          />
          <input
            type="number"
            inputMode="numeric"
            value={b ?? ""}
            disabled={isClosed}
            onChange={(e) =>
              saveHole(k, {
                teamAGross: a,
                teamBGross: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      );
    }

    if (format === "singles") {
      const a = input?.teamAPlayerGross ?? null;
      const b = input?.teamBPlayerGross ?? null;
      return (
        <div
          key={k}
          style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 8, alignItems: "center" }}
        >
          <div>#{k}</div>
          <input
            type="number"
            inputMode="numeric"
            value={a ?? ""}
            disabled={isClosed}
            onChange={(e) =>
              saveHole(k, {
                teamAPlayerGross: e.target.value === "" ? null : Number(e.target.value),
                teamBPlayerGross: b,
              })
            }
          />
          <input
            type="number"
            inputMode="numeric"
            value={b ?? ""}
            disabled={isClosed}
            onChange={(e) =>
              saveHole(k, {
                teamAPlayerGross: a,
                teamBPlayerGross: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      );
    }

    // twoManBestBall / twoManShamble
    const aArr: (number | null)[] = Array.isArray(input?.teamAPlayersGross)
      ? input.teamAPlayersGross
      : [null, null];
    const bArr: (number | null)[] = Array.isArray(input?.teamBPlayersGross)
      ? input.teamBPlayersGross
      : [null, null];

    const setA = (idx: 0 | 1, val: number | null) => {
      const nextA = [...aArr];
      nextA[idx] = val;
      saveHole(k, { teamAPlayersGross: nextA, teamBPlayersGross: bArr });
    };
    const setB = (idx: 0 | 1, val: number | null) => {
      const nextB = [...bArr];
      nextB[idx] = val;
      saveHole(k, { teamAPlayersGross: aArr, teamBPlayersGross: nextB });
    };

    return (
      <div
        key={k}
        style={{ display: "grid", gridTemplateColumns: "40px repeat(4, 1fr)", gap: 8, alignItems: "center" }}
      >
        <div>#{k}</div>
        <input
          type="number"
          inputMode="numeric"
          value={aArr[0] ?? ""}
          disabled={isClosed}
          onChange={(e) => setA(0, e.target.value === "" ? null : Number(e.target.value))}
        />
        <input
          type="number"
          inputMode="numeric"
          value={aArr[1] ?? ""}
          disabled={isClosed}
          onChange={(e) => setA(1, e.target.value === "" ? null : Number(e.target.value))}
        />
        <input
          type="number"
          inputMode="numeric"
          value={bArr[0] ?? ""}
          disabled={isClosed}
          onChange={(e) => setB(0, e.target.value === "" ? null : Number(e.target.value))}
        />
        <input
          type="number"
          inputMode="numeric"
          value={bArr[1] ?? ""}
          disabled={isClosed}
          onChange={(e) => setB(1, e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>
    );
  }

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!match) return <div style={{ padding: 16 }}>Match not found.</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2>Match {match.id}</h2>
      <div>
        <strong>Format:</strong> {format}
      </div>
      <div>
        <strong>Status:</strong>{" "}
        {match.status
          ? `${match.status.leader ?? "AS"} ${match.status.margin ?? 0} • thru ${
              match.status.thru ?? 0
            } • ${match.status.closed ? "Final" : "Live"}`
          : "—"}
      </div>
      {isClosed && (
        <div style={{ color: "#b91c1c" }}>
          Final — edit a prior hole to reopen
        </div>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        {holes.map((h) => (
          <HoleRow key={h.k} k={h.k} input={h.input} />
        ))}
      </div>
    </div>
  );
}