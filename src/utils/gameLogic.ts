import { GameState, PointType } from '../types';

export class GameLogic {
  static readonly MAX_SCORE = 13;
  static readonly HALFTIME_SCORE = 7;

  static createNewGame(
    teamA: string, 
    teamB: string, 
    startingPointType: PointType
  ): GameState {
    return {
      id: `game_${Date.now()}`,
      teamA,
      teamB,
      scoreA: 0,
      scoreB: 0,
      currentPointType: startingPointType,
      pointsUntilSwitch: 1, // First point, then switch
      isHalftime: false,
      isGameComplete: false,
      startTime: new Date(),
    };
  }

  static scorePoint(gameState: GameState, team: 'A' | 'B'): GameState {
    if (gameState.isGameComplete) {
      return gameState;
    }

    const newState = { ...gameState };
    
    // Update score
    if (team === 'A') {
      newState.scoreA += 1;
    } else {
      newState.scoreB += 1;
    }

    // Check for halftime (first team to reach 7)
    if (!newState.isHalftime && 
        (newState.scoreA >= this.HALFTIME_SCORE || newState.scoreB >= this.HALFTIME_SCORE)) {
      newState.isHalftime = true;
    }

    // Check for game completion
    if (newState.scoreA >= this.MAX_SCORE || newState.scoreB >= this.MAX_SCORE) {
      newState.isGameComplete = true;
      newState.endTime = new Date();
      return newState;
    }

    // Handle point type switching
    newState.pointsUntilSwitch -= 1;
    
    if (newState.pointsUntilSwitch <= 0) {
      // Switch point type
      newState.currentPointType = newState.currentPointType === 'FMP' ? 'MMP' : 'FMP';
      newState.pointsUntilSwitch = 2; // Next switch is after 2 points
    }

    return newState;
  }

  static undoLastPoint(gameState: GameState): GameState {
    // This is a simplified undo - in a full implementation, you'd want to store
    // a history of moves to properly undo the point type changes
    if (gameState.scoreA <= 0 && gameState.scoreB <= 0) {
      return gameState;
    }

    const newState = { ...gameState };
    
    // Find which team scored last (assume it was the team with higher score)
    if (newState.scoreA > newState.scoreB && newState.scoreA > 0) {
      newState.scoreA -= 1;
    } else if (newState.scoreB > 0) {
      newState.scoreB -= 1;
    }

    // Reset game completion
    newState.isGameComplete = false;
    newState.endTime = undefined;

    // Reset halftime if we go below 7
    if (newState.scoreA < this.HALFTIME_SCORE && newState.scoreB < this.HALFTIME_SCORE) {
      newState.isHalftime = false;
    }

    // Note: Point type logic for undo would need more sophisticated tracking
    // For now, we'll keep the current point type as-is

    return newState;
  }

  static getGameStatus(gameState: GameState): string {
    if (gameState.isGameComplete) {
      const winner = gameState.scoreA > gameState.scoreB ? gameState.teamA : gameState.teamB;
      const finalScore = `${gameState.scoreA}-${gameState.scoreB}`;
      return `Game Complete: ${winner} wins ${finalScore}`;
    }

    if (gameState.isHalftime && gameState.scoreA < this.HALFTIME_SCORE && gameState.scoreB < this.HALFTIME_SCORE) {
      return 'Halftime';
    }

    const totalPoints = gameState.scoreA + gameState.scoreB;
    return `Point ${totalPoints + 1}`;
  }

  static getNextPointType(gameState: GameState): PointType {
    if (gameState.pointsUntilSwitch <= 1) {
      return gameState.currentPointType === 'FMP' ? 'MMP' : 'FMP';
    }
    return gameState.currentPointType;
  }

  static formatPointType(pointType: PointType): string {
    return pointType === 'FMP' ? 'Female Matching Point' : 'Male Matching Point';
  }
}