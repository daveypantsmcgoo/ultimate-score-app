import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native';
import { TeamSelectionScreen } from './src/screens/TeamSelectionScreen';
import { ScoringScreen } from './src/screens/ScoringScreen';
import { GameHistoryScreen } from './src/screens/GameHistoryScreen';
import { Team } from './src/types';
import './global.css';

type Screen = 'team-selection' | 'scoring' | 'history';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('team-selection');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const handleTeamSelected = (team: Team) => {
    setSelectedTeam(team);
  };

  const handleStartNewGame = () => {
    setCurrentScreen('scoring');
  };

  const handleBackToTeamSelection = () => {
    setCurrentScreen('team-selection');
  };

  const handleViewHistory = () => {
    setCurrentScreen('history');
  };

  const handleBackFromHistory = () => {
    setCurrentScreen('scoring');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'team-selection':
        return (
          <TeamSelectionScreen
            onTeamSelected={handleTeamSelected}
            onStartNewGame={handleStartNewGame}
          />
        );
      case 'scoring':
        return (
          <ScoringScreen
            onBackToTeamSelection={handleBackToTeamSelection}
            onViewHistory={handleViewHistory}
          />
        );
      case 'history':
        return (
          <GameHistoryScreen
            onBack={handleBackFromHistory}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {renderScreen()}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}
