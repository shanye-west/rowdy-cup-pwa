export type RoundFormat = "twoManBestBall" | "twoManShamble" | "twoManScramble" | "singles";

export type PlayerDoc = { 
  id: string; 
  displayName?: string; 
  username?: string; 
};

// NEW: Helper for the Tier Arrays
export type TierMap = {
  A?: string[];
  B?: string[];
  C?: string[];
  D?: string[];
};

export type TournamentDoc = {
  id: string;
  name: string;
  teamA: { 
    id: string; 
    name: string; 
    color?: string; 
    rosterByTier?: TierMap; // <--- Nested inside the team
  };
  teamB: { 
    id: string; 
    name: string; 
    color?: string; 
    rosterByTier?: TierMap; // <--- Nested here too
  };
};

export type RoundDoc = {
  id: string;
  tournamentId: string;
  day?: number;
  format: RoundFormat;
  // NEW: Master Switch
  locked?: boolean; 
};

export type MatchDoc = {
  id: string;
  roundId: string;
  tournamentId?: string;
  pointsValue?: number;
  holes?: Record<string, { input: any }>;
  result?: { 
    winner?: "teamA" | "teamB" | "AS";
    holesWonA?: number;
    holesWonB?: number;
  };
  status?: {
    leader: "teamA" | "teamB" | null;
    margin: number;
    thru: number;
    dormie: boolean;
    closed: boolean;
  };
  teamAPlayers?: { playerId: string; strokesReceived: number[] }[];
  teamBPlayers?: { playerId: string; strokesReceived: number[] }[];
};