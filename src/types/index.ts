export type PointType = 'FMP' | 'MMP';

export interface GameState {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  currentPointType: PointType;
  pointsUntilSwitch: number;
  isHalftime: boolean;
  isGameComplete: boolean;
  startTime: Date;
  endTime?: Date;
}

export interface Division {
  id: string;
  name: string;
  season: string;
}

export interface Team {
  id: string;
  name: string;
  divisionId: string;
  jerseyColor?: string;
}

export interface Game {
  id: string;
  date: Date;
  time: string;
  teamA: Team;
  teamB: Team;
  field: Field;
  isComplete: boolean;
  scoreA?: number;
  scoreB?: number;
}

export interface Field {
  id: string;
  name: string;
  mapUrl?: string;
  diagramUrl?: string;
}