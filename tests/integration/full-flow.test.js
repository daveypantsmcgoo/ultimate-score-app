const request = require('supertest');
const { DatabaseService } = require('../../api/_lib/database/connection.js');

describe('Integration Tests - Full API Flow', () => {
  const API_KEY = 'mufa-public-2025';
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('should complete full user flow', async () => {
    // 1. Get divisions
    const divisionsResponse = await request(BASE_URL)
      .get(`/api/v2/divisions?apiKey=${API_KEY}`)
      .expect(200);

    expect(divisionsResponse.body.length).toBeGreaterThan(0);
    const divisionId = divisionsResponse.body[0].id;

    // 2. Get teams for first division
    const teamsResponse = await request(BASE_URL)
      .get(`/api/v2/teams?divisionId=${divisionId}&apiKey=${API_KEY}`)
      .expect(200);

    expect(Array.isArray(teamsResponse.body)).toBe(true);

    // 3. If teams exist, get schedule for first team
    if (teamsResponse.body.length > 0) {
      const teamId = teamsResponse.body[0].id;
      
      const scheduleResponse = await request(BASE_URL)
        .get(`/api/v2/schedule?teamId=${teamId}&divisionId=${divisionId}&apiKey=${API_KEY}`)
        .expect(200);

      expect(Array.isArray(scheduleResponse.body)).toBe(true);
    }
  });

  test('should handle database refresh flow', async () => {
    // Test manual refresh endpoint
    const refreshResponse = await request(BASE_URL)
      .post(`/api/v2/refresh`)
      .send({ teamId: '6097', divisionId: '517' })
      .set('X-API-Key', API_KEY)
      .expect(200);

    expect(refreshResponse.body).toHaveProperty('success');
    expect(refreshResponse.body).toHaveProperty('changes');
    expect(refreshResponse.body).toHaveProperty('duration');
  });
});

describe('Database Integration Tests', () => {
  test('should maintain data consistency', async () => {
    // Get current season
    const season = await DatabaseService.getCurrentSeason();
    expect(season).toBeTruthy();

    // Get divisions for that season
    const divisions = await DatabaseService.getDivisions(season.id);
    expect(divisions.length).toBeGreaterThan(0);

    // Verify all divisions belong to current season
    divisions.forEach(division => {
      expect(division.season_id).toBe(season.id);
    });
  });

  test('should handle concurrent requests', async () => {
    // Make multiple concurrent requests
    const promises = Array(5).fill().map(() => 
      DatabaseService.getDivisions()
    );

    const results = await Promise.all(promises);
    
    // All should return the same data
    results.forEach(result => {
      expect(result.length).toBe(results[0].length);
    });
  });
});

describe('Performance Tests', () => {
  test('divisions endpoint should be fast', async () => {
    const start = Date.now();
    
    const divisions = await DatabaseService.getDivisions();
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500); // Under 500ms
    expect(divisions.length).toBeGreaterThan(0);
  });

  test('should handle multiple API calls efficiently', async () => {
    const start = Date.now();
    
    // Make 10 concurrent API calls
    const promises = Array(10).fill().map(() => 
      DatabaseService.getDivisions()
    );
    
    await Promise.all(promises);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000); // Under 2 seconds for 10 calls
  });
});