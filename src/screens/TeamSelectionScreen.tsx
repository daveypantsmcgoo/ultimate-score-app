import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { Picker } from '../components/Picker';
import { Division, Team, Game } from '../types';
import { MufaService } from '../services/mufaService';
import { StorageService } from '../services/storageService';

interface TeamSelectionScreenProps {
  onTeamSelected: (team: Team) => void;
  onStartNewGame: () => void;
}

export const TeamSelectionScreen: React.FC<TeamSelectionScreenProps> = ({
  onTeamSelected,
  onStartNewGame,
}) => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedule, setSchedule] = useState<Game[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDivisions();
    loadSelectedTeam();
  }, []);

  useEffect(() => {
    if (selectedDivisionId) {
      loadTeams(selectedDivisionId);
    }
  }, [selectedDivisionId]);

  useEffect(() => {
    if (selectedTeamId) {
      const team = teams.find(t => t.id === selectedTeamId);
      if (team) {
        setSelectedTeam(team);
        onTeamSelected(team);
        StorageService.saveSelectedTeam(team);
        loadSchedule(selectedTeamId);
      }
    }
  }, [selectedTeamId, teams]);

  const loadDivisions = async () => {
    try {
      setLoading(true);
      // Try to load from cache first
      let cachedDivisions = await StorageService.getCachedDivisions();
      if (cachedDivisions.length > 0) {
        setDivisions(cachedDivisions);
      }

      // Load fresh data
      const freshDivisions = await MufaService.getDivisions();
      setDivisions(freshDivisions);
      await StorageService.cacheDivisions(freshDivisions);
    } catch (error) {
      Alert.alert('Error', 'Failed to load divisions');
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async (divisionId: string) => {
    try {
      setLoading(true);
      // Try cache first
      let cachedTeams = await StorageService.getCachedTeams(divisionId);
      if (cachedTeams.length > 0) {
        setTeams(cachedTeams);
      }

      // Load fresh data
      const freshTeams = await MufaService.getTeamsForDivision(divisionId);
      setTeams(freshTeams);
      await StorageService.cacheTeams(divisionId, freshTeams);
    } catch (error) {
      Alert.alert('Error', 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (teamId: string) => {
    try {
      // Try cache first
      let cachedSchedule = await StorageService.getCachedSchedule(teamId);
      if (cachedSchedule.length > 0) {
        setSchedule(cachedSchedule);
      }

      // Load fresh data
      const team = teams.find(t => t.id === teamId);
      if (team) {
        const freshSchedule = await MufaService.getTeamSchedule(teamId, team.divisionId);
        setSchedule(freshSchedule);
        await StorageService.cacheSchedule(teamId, freshSchedule);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load schedule');
    }
  };

  const loadSelectedTeam = async () => {
    const team = await StorageService.getSelectedTeam();
    if (team) {
      setSelectedTeam(team);
      setSelectedDivisionId(team.divisionId);
      setSelectedTeamId(team.id);
    }
  };

  const getNextGame = (): Game | null => {
    const now = new Date();
    const upcomingGames = schedule.filter(game => game.date >= now && !game.isComplete);
    return upcomingGames.length > 0 ? upcomingGames[0] : null;
  };

  const openMap = (mapUrl: string) => {
    if (mapUrl) {
      Linking.openURL(mapUrl);
    }
  };

  const nextGame = getNextGame();

  const divisionItems = divisions.map(div => ({
    label: div.name,
    value: div.id,
  }));

  const teamItems = teams.map(team => ({
    label: team.name,
    value: team.id,
  }));

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-6 pt-12">
        <Text className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Ultimate Score
        </Text>

        <View className="space-y-4">
          <View>
            <Text className="text-lg font-semibold text-gray-700 mb-2">
              Select Division
            </Text>
            <Picker
              items={divisionItems}
              selectedValue={selectedDivisionId}
              onValueChange={setSelectedDivisionId}
              placeholder="Choose your division"
            />
          </View>

          {selectedDivisionId && (
            <View>
              <Text className="text-lg font-semibold text-gray-700 mb-2">
                Select Team
              </Text>
              <Picker
                items={teamItems}
                selectedValue={selectedTeamId}
                onValueChange={setSelectedTeamId}
                placeholder="Choose your team"
              />
            </View>
          )}

          {nextGame && (
            <View className="bg-white rounded-lg p-4 border border-gray-200 mt-6">
              <Text className="text-lg font-semibold text-gray-900 mb-3">
                Next Game
              </Text>
              <Text className="text-gray-700 text-base mb-1">
                vs {nextGame.teamA.id === selectedTeamId ? nextGame.teamB.name : nextGame.teamA.name}
              </Text>
              <Text className="text-gray-600 text-sm mb-1">
                {nextGame.date.toLocaleDateString()} at {nextGame.time}
              </Text>
              <Text className="text-gray-600 text-sm mb-3">
                {nextGame.field.name}
              </Text>
              
              <View className="flex-row space-x-3">
                {nextGame.field.mapUrl && (
                  <TouchableOpacity
                    className="bg-blue-600 px-4 py-2 rounded-lg flex-1"
                    onPress={() => openMap(nextGame.field.mapUrl!)}
                  >
                    <Text className="text-white text-center font-medium">
                      Get Directions
                    </Text>
                  </TouchableOpacity>
                )}

                {nextGame.field.diagramUrl && (
                  <TouchableOpacity
                    className="bg-green-600 px-4 py-2 rounded-lg flex-1"
                    onPress={() => openMap(nextGame.field.diagramUrl!)}
                  >
                    <Text className="text-white text-center font-medium">
                      Field Diagram
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            className="bg-orange-600 py-4 px-6 rounded-lg mt-8"
            onPress={onStartNewGame}
            disabled={!selectedTeam}
          >
            <Text className="text-white text-center text-lg font-semibold">
              Start New Game
            </Text>
          </TouchableOpacity>

          {loading && (
            <Text className="text-center text-gray-500 mt-4">Loading...</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};