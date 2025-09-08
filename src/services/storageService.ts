import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, Division, Team, Game } from '../types';

const STORAGE_KEYS = {
  GAMES: 'ultimate_games',
  SELECTED_TEAM: 'selected_team',
  DIVISIONS: 'divisions',
  TEAMS: 'teams',
  SCHEDULES: 'schedules',
} as const;

export class StorageService {
  // Game State Management
  static async saveGame(game: GameState): Promise<void> {
    try {
      const existingGames = await this.getAllGames();
      const gameIndex = existingGames.findIndex(g => g.id === game.id);
      
      if (gameIndex >= 0) {
        existingGames[gameIndex] = game;
      } else {
        existingGames.push(game);
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(existingGames));
    } catch (error) {
      console.error('Error saving game:', error);
      throw error;
    }
  }

  static async getAllGames(): Promise<GameState[]> {
    try {
      const gamesJson = await AsyncStorage.getItem(STORAGE_KEYS.GAMES);
      if (!gamesJson) return [];
      
      const games = JSON.parse(gamesJson);
      // Convert date strings back to Date objects
      return games.map((game: any) => ({
        ...game,
        startTime: new Date(game.startTime),
        endTime: game.endTime ? new Date(game.endTime) : undefined,
      }));
    } catch (error) {
      console.error('Error loading games:', error);
      return [];
    }
  }

  static async getGame(gameId: string): Promise<GameState | null> {
    try {
      const games = await this.getAllGames();
      return games.find(game => game.id === gameId) || null;
    } catch (error) {
      console.error('Error loading game:', error);
      return null;
    }
  }

  static async deleteGame(gameId: string): Promise<void> {
    try {
      const games = await this.getAllGames();
      const filteredGames = games.filter(game => game.id !== gameId);
      await AsyncStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(filteredGames));
    } catch (error) {
      console.error('Error deleting game:', error);
      throw error;
    }
  }

  // Team Selection
  static async saveSelectedTeam(team: Team): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_TEAM, JSON.stringify(team));
    } catch (error) {
      console.error('Error saving selected team:', error);
      throw error;
    }
  }

  static async getSelectedTeam(): Promise<Team | null> {
    try {
      const teamJson = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAM);
      return teamJson ? JSON.parse(teamJson) : null;
    } catch (error) {
      console.error('Error loading selected team:', error);
      return null;
    }
  }

  // Cache Management for MUFA data
  static async cacheDivisions(divisions: Division[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(divisions));
    } catch (error) {
      console.error('Error caching divisions:', error);
    }
  }

  static async getCachedDivisions(): Promise<Division[]> {
    try {
      const divisionsJson = await AsyncStorage.getItem(STORAGE_KEYS.DIVISIONS);
      return divisionsJson ? JSON.parse(divisionsJson) : [];
    } catch (error) {
      console.error('Error loading cached divisions:', error);
      return [];
    }
  }

  static async cacheTeams(divisionId: string, teams: Team[]): Promise<void> {
    try {
      const cacheKey = `${STORAGE_KEYS.TEAMS}_${divisionId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(teams));
    } catch (error) {
      console.error('Error caching teams:', error);
    }
  }

  static async getCachedTeams(divisionId: string): Promise<Team[]> {
    try {
      const cacheKey = `${STORAGE_KEYS.TEAMS}_${divisionId}`;
      const teamsJson = await AsyncStorage.getItem(cacheKey);
      return teamsJson ? JSON.parse(teamsJson) : [];
    } catch (error) {
      console.error('Error loading cached teams:', error);
      return [];
    }
  }

  static async cacheSchedule(teamId: string, schedule: Game[]): Promise<void> {
    try {
      const cacheKey = `${STORAGE_KEYS.SCHEDULES}_${teamId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(schedule));
    } catch (error) {
      console.error('Error caching schedule:', error);
    }
  }

  static async getCachedSchedule(teamId: string): Promise<Game[]> {
    try {
      const cacheKey = `${STORAGE_KEYS.SCHEDULES}_${teamId}`;
      const scheduleJson = await AsyncStorage.getItem(cacheKey);
      if (!scheduleJson) return [];
      
      const schedule = JSON.parse(scheduleJson);
      // Convert date strings back to Date objects
      return schedule.map((game: any) => ({
        ...game,
        date: new Date(game.date),
      }));
    } catch (error) {
      console.error('Error loading cached schedule:', error);
      return [];
    }
  }

  // Clear all data
  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
      // Also clear any dynamic cache keys
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith(STORAGE_KEYS.TEAMS) || key.startsWith(STORAGE_KEYS.SCHEDULES)
      );
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }
}