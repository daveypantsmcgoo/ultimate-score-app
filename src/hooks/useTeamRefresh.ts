import { useState } from 'react';
import { MufaService } from '../services/mufaService';
import { Game } from '../types';

export const useTeamRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refreshTeam = async (teamId: string, divisionId: string): Promise<{
    success: boolean;
    games?: Game[];
    message: string;
    hasChanges: boolean;
  }> => {
    setIsRefreshing(true);
    
    try {
      const result = await MufaService.refreshTeamData(teamId, divisionId);
      
      if (result.success) {
        setLastRefresh(new Date());
      }
      
      return {
        success: result.success,
        games: result.data,
        message: result.message,
        hasChanges: result.changes.hasChanges
      };
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    refreshTeam,
    isRefreshing,
    lastRefresh
  };
};

// Usage example:
/*
import { useTeamRefresh } from '../hooks/useTeamRefresh';

const TeamScheduleScreen = ({ teamId, divisionId }) => {
  const { refreshTeam, isRefreshing, lastRefresh } = useTeamRefresh();
  const [games, setGames] = useState([]);
  const [message, setMessage] = useState('');

  const handleRefresh = async () => {
    const result = await refreshTeam(teamId, divisionId);
    
    if (result.success && result.games) {
      setGames(result.games);
    }
    
    setMessage(result.message);
    
    // Show toast/alert with the message
    if (result.hasChanges) {
      Alert.alert('Updated!', result.message);
    }
  };

  return (
    <View>
      <Button 
        title={isRefreshing ? 'Refreshing...' : 'Refresh Schedule'} 
        onPress={handleRefresh}
        disabled={isRefreshing}
      />
      {lastRefresh && (
        <Text>Last updated: {lastRefresh.toLocaleTimeString()}</Text>
      )}
      {message && <Text>{message}</Text>}
    </View>
  );
};
*/