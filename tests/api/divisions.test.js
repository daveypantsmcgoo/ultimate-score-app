const request = require('supertest');
const divisionsHandler = require('../../api/v2/divisions.js');

// Mock the database service
jest.mock('../../api/_lib/database/connection.js', () => ({
  DatabaseService: {
    getDivisions: jest.fn()
  }
}));

const { DatabaseService } = require('../../api/_lib/database/connection.js');

// Create a simple Express-like app for testing
const express = require('express');
const app = express();
app.use(express.json());
app.all('/api/v2/divisions', (req, res) => divisionsHandler.default(req, res));

describe('API: /api/v2/divisions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return divisions successfully', async () => {
    const mockDivisions = [
      { id: '517', name: 'Sun - FMP', season_id: 'fall-2025' },
      { id: '518', name: 'Sun - MMP', season_id: 'fall-2025' }
    ];
    
    DatabaseService.getDivisions.mockResolvedValue(mockDivisions);

    const response = await request(app)
      .get('/api/v2/divisions?apiKey=mufa-public-2025')
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toEqual({
      id: '517',
      name: 'Sun - FMP',
      season: 'Fall 2025'
    });
  });

  test('should require API key', async () => {
    const response = await request(app)
      .get('/api/v2/divisions')
      .expect(401);

    expect(response.body.error).toBe('API key required');
  });

  test('should reject invalid API key', async () => {
    const response = await request(app)
      .get('/api/v2/divisions?apiKey=invalid-key')
      .expect(401);

    expect(response.body.error).toBe('API key required');
  });

  test('should handle empty divisions', async () => {
    DatabaseService.getDivisions.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/v2/divisions?apiKey=mufa-public-2025')
      .expect(404);

    expect(response.body.error).toBe('No divisions found');
  });

  test('should handle database errors', async () => {
    DatabaseService.getDivisions.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .get('/api/v2/divisions?apiKey=mufa-public-2025')
      .expect(500);

    expect(response.body.error).toBe('Failed to fetch divisions');
  });

  test('should reject non-GET methods', async () => {
    const response = await request(app)
      .post('/api/v2/divisions?apiKey=mufa-public-2025')
      .expect(405);

    expect(response.body.error).toBe('Method not allowed');
  });

  test('should include proper cache headers', async () => {
    const mockDivisions = [
      { id: '517', name: 'Sun - FMP', season_id: 'fall-2025' }
    ];
    
    DatabaseService.getDivisions.mockResolvedValue(mockDivisions);

    const response = await request(app)
      .get('/api/v2/divisions?apiKey=mufa-public-2025')
      .expect(200);

    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.headers['x-data-source']).toBe('database');
    expect(response.headers['x-data-count']).toBe('1');
  });
});