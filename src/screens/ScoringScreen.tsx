import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { GameState, PointType } from '../types';
import { GameLogic } from '../utils/gameLogic';
import { StorageService } from '../services/storageService';

interface ScoringScreenProps {
  onBackToTeamSelection: () => void;
  onViewHistory: () => void;
}

export const ScoringScreen: React.FC<ScoringScreenProps> = ({
  onBackToTeamSelection,
  onViewHistory,
}) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isSetupModalVisible, setIsSetupModalVisible] = useState(false);

  useEffect(() => {
    if (!gameState) {
      setIsSetupModalVisible(true);
    }
  }, [gameState]);

  const startNewGame = (teamA: string, teamB: string, startingPointType: PointType) => {
    const newGame = GameLogic.createNewGame(teamA, teamB, startingPointType);
    setGameState(newGame);
    StorageService.saveGame(newGame);
    setIsSetupModalVisible(false);
  };

  const scorePoint = (team: 'A' | 'B') => {
    if (!gameState) return;

    const newState = GameLogic.scorePoint(gameState, team);
    setGameState(newState);
    StorageService.saveGame(newState);

    if (newState.isGameComplete) {
      const winner = newState.scoreA > newState.scoreB ? newState.teamA : newState.teamB;
      Alert.alert(
        'Game Complete!',
        `${winner} wins ${newState.scoreA}-${newState.scoreB}!`,
        [
          { text: 'New Game', onPress: () => setIsSetupModalVisible(true) },
          { text: 'View History', onPress: onViewHistory },
        ]
      );
    }
  };

  const undoLastPoint = () => {
    if (!gameState) return;

    Alert.alert(
      'Undo Last Point',
      'Are you sure you want to undo the last point?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          onPress: () => {
            const newState = GameLogic.undoLastPoint(gameState);
            setGameState(newState);
            StorageService.saveGame(newState);
          },
        },
      ]
    );
  };

  if (isSetupModalVisible) {
    return <GameSetupModal onStartGame={startNewGame} onCancel={onBackToTeamSelection} />;
  }

  if (!gameState) {
    return null;
  }

  const nextPointType = GameLogic.getNextPointType(gameState);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-6">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={onBackToTeamSelection}>
            <Text className="text-blue-600 text-base">← Teams</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">
            {GameLogic.getGameStatus(gameState)}
          </Text>
          <TouchableOpacity onPress={onViewHistory}>
            <Text className="text-blue-600 text-base">History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Score Display */}
      <View className="flex-1 justify-center px-6">
        <View className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-1 items-center">
              <Text className="text-lg font-medium text-gray-700 mb-2">
                {gameState.teamA}
              </Text>
              <Text className="text-6xl font-bold text-blue-600">
                {gameState.scoreA}
              </Text>
            </View>
            
            <View className="px-4">
              <Text className="text-2xl font-light text-gray-400">-</Text>
            </View>
            
            <View className="flex-1 items-center">
              <Text className="text-lg font-medium text-gray-700 mb-2">
                {gameState.teamB}
              </Text>
              <Text className="text-6xl font-bold text-red-600">
                {gameState.scoreB}
              </Text>
            </View>
          </View>

          {gameState.isHalftime && !gameState.isGameComplete && (
            <View className="bg-yellow-100 p-3 rounded-lg mb-4">
              <Text className="text-center text-yellow-800 font-medium">
                HALFTIME
              </Text>
            </View>
          )}
        </View>

        {/* Point Type Display */}
        <View className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <Text className="text-center text-gray-600 text-sm mb-1">Current Point</Text>
          <Text className="text-center text-xl font-semibold text-gray-900 mb-2">
            {GameLogic.formatPointType(gameState.currentPointType)}
          </Text>
          {gameState.pointsUntilSwitch > 1 && (
            <Text className="text-center text-gray-500 text-sm">
              Next: {GameLogic.formatPointType(nextPointType)} in {gameState.pointsUntilSwitch - 1} point{gameState.pointsUntilSwitch > 2 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Scoring Buttons */}
        {!gameState.isGameComplete && (
          <View className="flex-row space-x-4 mb-6">
            <TouchableOpacity
              className="flex-1 bg-blue-600 py-4 rounded-lg"
              onPress={() => scorePoint('A')}
            >
              <Text className="text-white text-center text-lg font-semibold">
                +1 {gameState.teamA}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="flex-1 bg-red-600 py-4 rounded-lg"
              onPress={() => scorePoint('B')}
            >
              <Text className="text-white text-center text-lg font-semibold">
                +1 {gameState.teamB}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View className="flex-row space-x-4">
          <TouchableOpacity
            className="flex-1 bg-gray-600 py-3 rounded-lg"
            onPress={undoLastPoint}
            disabled={gameState.scoreA === 0 && gameState.scoreB === 0}
          >
            <Text className="text-white text-center font-medium">
              Undo Last Point
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className="flex-1 bg-green-600 py-3 rounded-lg"
            onPress={() => setIsSetupModalVisible(true)}
          >
            <Text className="text-white text-center font-medium">
              New Game
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Game Setup Modal Component
interface GameSetupModalProps {
  onStartGame: (teamA: string, teamB: string, startingPointType: PointType) => void;
  onCancel: () => void;
}

const GameSetupModal: React.FC<GameSetupModalProps> = ({ onStartGame, onCancel }) => {
  const [teamA, setTeamA] = useState('Team A');
  const [teamB, setTeamB] = useState('Team B');
  const [startingPointType, setStartingPointType] = useState<PointType>('FMP');

  return (
    <View className="flex-1 bg-gray-50 justify-center px-6">
      <View className="bg-white rounded-lg p-6 border border-gray-200">
        <Text className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Game Setup
        </Text>

        <View className="space-y-4">
          <View>
            <Text className="text-lg font-medium text-gray-700 mb-2">Team A Name</Text>
            <View className="border border-gray-300 rounded-lg px-4 py-3">
              <Text className="text-gray-900">{teamA}</Text>
            </View>
          </View>

          <View>
            <Text className="text-lg font-medium text-gray-700 mb-2">Team B Name</Text>
            <View className="border border-gray-300 rounded-lg px-4 py-3">
              <Text className="text-gray-900">{teamB}</Text>
            </View>
          </View>

          <View>
            <Text className="text-lg font-medium text-gray-700 mb-2">Starting Point Type</Text>
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className={`flex-1 py-3 px-4 rounded-lg border ${
                  startingPointType === 'FMP' 
                    ? 'bg-blue-600 border-blue-600' 
                    : 'bg-white border-gray-300'
                }`}
                onPress={() => setStartingPointType('FMP')}
              >
                <Text className={`text-center font-medium ${
                  startingPointType === 'FMP' ? 'text-white' : 'text-gray-700'
                }`}>
                  FMP
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className={`flex-1 py-3 px-4 rounded-lg border ${
                  startingPointType === 'MMP' 
                    ? 'bg-blue-600 border-blue-600' 
                    : 'bg-white border-gray-300'
                }`}
                onPress={() => setStartingPointType('MMP')}
              >
                <Text className={`text-center font-medium ${
                  startingPointType === 'MMP' ? 'text-white' : 'text-gray-700'
                }`}>
                  MMP
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="flex-row space-x-4 mt-8">
          <TouchableOpacity
            className="flex-1 bg-gray-600 py-3 rounded-lg"
            onPress={onCancel}
          >
            <Text className="text-white text-center font-medium">Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className="flex-1 bg-green-600 py-3 rounded-lg"
            onPress={() => onStartGame(teamA, teamB, startingPointType)}
          >
            <Text className="text-white text-center font-medium">Start Game</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};