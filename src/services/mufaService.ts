import { Division, Team, Game, Field } from '../types';

// Use the production domain for the API
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ultimate-score-app-one.vercel.app/api/v2';
const API_KEY = 'mufa-public-2025';
const MUFA_BASE_URL = 'https://www.mufa.org';

// Helper to add API key to requests
const fetchWithAuth = (url: string, options: RequestInit = {}) => {
  return fetch(`${url}?apiKey=${API_KEY}`, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  });
};

export class MufaService {
  static async getDivisions(): Promise<Division[]> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/divisions`);
      if (!response.ok) {
        throw new Error('Failed to fetch divisions');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching divisions:', error);
      // Fallback to basic error state - user should refresh
      return [];
    }
  }

  static async getTeamsForDivision(divisionId: string): Promise<Team[]> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/teams?divisionId=${divisionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Return empty array - user should refresh to retry
      return [];
    }
  }

  static async getTeamSchedule(teamId: string, divisionId: string): Promise<Game[]> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/schedule?teamId=${teamId}&divisionId=${divisionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch schedule');
      }
      const scheduleData = await response.json();
      
      // Convert date strings to Date objects
      return scheduleData.map((game: any) => ({
        ...game,
        date: new Date(game.date)
      }));
    } catch (error) {
      console.error('Error fetching schedule:', error);
      // Return empty array - user should refresh to retry
      return [];
    }
  }

  static async refreshTeamData(teamId: string, divisionId: string): Promise<{
    success: boolean;
    changes: {
      newGames: number;
      newScores: number;
      hasChanges: boolean;
    };
    data?: Game[];
    message: string;
  }> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teamId, divisionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh team data');
      }

      const result = await response.json();
      
      // Convert date strings to Date objects if data is included
      if (result.data?.games) {
        result.data.games = result.data.games.map((game: any) => ({
          ...game,
          date: new Date(game.date)
        }));
      }

      return result;
    } catch (error) {
      console.error('Error refreshing team data:', error);
      return {
        success: false,
        changes: { newGames: 0, newScores: 0, hasChanges: false },
        message: 'Failed to refresh data. Please try again later.'
      };
    }
  }

  // Helper function to build URLs for actual scraping (when implemented with backend)
  static buildTeamUrl(teamId: string, divisionId: string): string {
    return `${MUFA_BASE_URL}/League/Division/Team.aspx?t=${teamId}&d=${divisionId}`;
  }

  static buildDivisionUrl(divisionId: string): string {
    return `${MUFA_BASE_URL}/League/Division/HomeArticle.aspx?d=${divisionId}`;
  }
}