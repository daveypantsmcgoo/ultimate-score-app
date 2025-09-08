import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { GameState } from '../types';
import { StorageService } from '../services/storageService';

interface GameHistoryScreenProps {
  onBack: () => void;
}

export const GameHistoryScreen: React.FC<GameHistoryScreenProps> = ({ onBack }) => {
  const [games, setGames] = useState<GameState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      setLoading(true);
      const allGames = await StorageService.getAllGames();
      // Sort by start time, newest first
      const sortedGames = allGames.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      setGames(sortedGames);
    } catch (error) {
      Alert.alert('Error', 'Failed to load game history');
    } finally {
      setLoading(false);
    }
  };

  const deleteGame = (gameId: string) => {
    Alert.alert(
      'Delete Game',
      'Are you sure you want to delete this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.deleteGame(gameId);
              await loadGames(); // Refresh the list
            } catch (error) {
              Alert.alert('Error', 'Failed to delete game');
            }
          },
        },
      ]
    );
  };

  const clearAllGames = () => {
    Alert.alert(
      'Clear All Games',
      'Are you sure you want to delete all game history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.clearAllData();
              setGames([]);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear games');
            }
          },
        },
      ]
    );
  };

  const formatGameDuration = (startTime: Date, endTime?: Date): string => {
    if (!endTime) return 'In Progress';
    
    const durationMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const renderGameItem = ({ item }: { item: GameState }) => {
    const winner = item.isGameComplete
      ? item.scoreA > item.scoreB
        ? item.teamA
        : item.teamB
      : null;

    return (
      <View className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-900">
              {item.teamA} vs {item.teamB}
            </Text>
            <Text className="text-sm text-gray-500">
              {item.startTime.toLocaleDateString()} at {item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => deleteGame(item.id)}
            className="p-2"
          >
            <Text className="text-red-600 text-sm">Delete</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-4">
            <Text className="text-2xl font-bold text-blue-600">
              {item.scoreA}
            </Text>
            <Text className="text-xl text-gray-400">-</Text>
            <Text className="text-2xl font-bold text-red-600">
              {item.scoreB}
            </Text>
          </View>
          
          <View className="items-end">
            {item.isGameComplete ? (
              <View>
                <Text className="text-sm font-medium text-green-600">
                  Complete
                </Text>
                {winner && (
                  <Text className="text-xs text-gray-500">
                    {winner} wins
                  </Text>
                )}
              </View>
            ) : (
              <Text className="text-sm font-medium text-orange-600">
                In Progress
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
          <Text className="text-xs text-gray-500">
            Duration: {formatGameDuration(item.startTime, item.endTime)}
          </Text>
          <Text className="text-xs text-gray-500">
            Current: {item.currentPointType}
          </Text>
        </View>

        {item.isHalftime && (
          <View className="bg-yellow-100 px-2 py-1 rounded mt-2">
            <Text className="text-xs text-yellow-800 text-center">
              Halftime Reached
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-6">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={onBack}>
            <Text className="text-blue-600 text-base">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">
            Game History
          </Text>
          {games.length > 0 && (
            <TouchableOpacity onPress={clearAllGames}>
              <Text className="text-red-600 text-base">Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 pt-4">
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500">Loading...</Text>
          </View>
        ) : games.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500 text-lg mb-2">No games played yet</Text>
            <Text className="text-gray-400 text-center">
              Start your first game to see it appear here
            </Text>
          </View>
        ) : (
          <>
            <View className="mb-4">
              <Text className="text-gray-600 text-sm">
                {games.length} game{games.length !== 1 ? 's' : ''} played
              </Text>
            </View>
            <FlatList
              data={games}
              renderItem={renderGameItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>
    </View>
  );
};