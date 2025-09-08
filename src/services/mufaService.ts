import { Division, Team, Game, Field } from '../types';

// Replace with your actual Vercel deployment URL after deploying
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ultimate-score-7z9qb82wh-greg-ks-projects.vercel.app/api/v2';
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
      // Fallback to mock data
      return [
        { id: '517', name: 'Sun - FMP', season: 'Fall 2025' },
        { id: '518', name: 'Sun - MMP', season: 'Fall 2025' },
        { id: '519', name: 'Mon (Early Bird) - Mixed', season: 'Fall 2025' },
        { id: '520', name: 'Tue - Mixed', season: 'Fall 2025' },
        { id: '521', name: 'Wed - Mixed', season: 'Fall 2025' },
        { id: '522', name: 'Thu - Mixed', season: 'Fall 2025' },
      ];
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
      // Fallback to mock data
      const mockTeams: { [key: string]: Team[] } = {
        '517': [
          { id: '6097', name: 'Dryad', divisionId: '517', jerseyColor: 'Neon Pink' },
          { id: '6098', name: 'Thunder Cats', divisionId: '517', jerseyColor: 'Blue' },
          { id: '6099', name: 'Phoenix Rising', divisionId: '517', jerseyColor: 'Red' },
          { id: '6100', name: 'Storm Chasers', divisionId: '517', jerseyColor: 'Green' },
        ],
        '518': [
          { id: '6101', name: 'Lightning Bolts', divisionId: '518', jerseyColor: 'Yellow' },
          { id: '6102', name: 'Wind Warriors', divisionId: '518', jerseyColor: 'Purple' },
        ]
      };
      return mockTeams[divisionId] || [];
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
      // Fallback to mock data
      const mockFields: Field[] = [
        { 
          id: 'burr1', 
          name: 'Burr Jones 1',
          mapUrl: 'https://maps.google.com/burr-jones',
          diagramUrl: 'https://mufa.org/fields/burr-jones-diagram.jpg'
        },
        { 
          id: 'demetral2', 
          name: 'Demetral 2',
          mapUrl: 'https://maps.google.com/demetral',
          diagramUrl: 'https://mufa.org/fields/demetral-diagram.jpg'
        }
      ];

      const mockTeam: Team = { id: teamId, name: 'Your Team', divisionId };
      const mockOpponent: Team = { id: '6098', name: 'Thunder Cats', divisionId };

      return [
        {
          id: 'game1',
          date: new Date('2025-02-23'),
          time: '1:00 PM',
          teamA: mockTeam,
          teamB: mockOpponent,
          field: mockFields[0],
          isComplete: false
        },
        {
          id: 'game2',
          date: new Date('2025-03-02'),
          time: '2:30 PM',
          teamA: mockOpponent,
          teamB: mockTeam,
          field: mockFields[1],
          isComplete: false
        }
      ];
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