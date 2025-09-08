// Test setup and utilities
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://test_user:test_password@localhost:5433/mufa_test';

// Mock console methods in tests to reduce noise
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Test utilities
global.testUtils = {
  // Create mock request/response objects
  mockRequest: (overrides = {}) => ({
    method: 'GET',
    query: {},
    body: {},
    headers: {},
    ...overrides
  }),

  mockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis()
    };
    return res;
  },

  // Wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate test data
  generateMockDivision: (id = '517') => ({
    id,
    name: `Test Division ${id}`,
    season_id: 'fall-2025',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }),

  generateMockTeam: (id = '6097', divisionId = '517') => ({
    id,
    name: `Test Team ${id}`,
    division_id: divisionId,
    jersey_color: 'Blue',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }),

  generateMockGame: (teamAId = '6097', teamBId = '6098', divisionId = '517') => ({
    id: `game-${divisionId}-${teamAId}-${Date.now()}`,
    division_id: divisionId,
    team_a_id: teamAId,
    team_b_id: teamBId,
    game_date: '2025-09-07',
    game_time: '18:00:00',
    is_complete: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
};

// Setup test database connection timeout
jest.setTimeout(30000);