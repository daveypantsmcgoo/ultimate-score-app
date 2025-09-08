const { DatabaseService } = require('../../api/_lib/database/connection.js');

describe('Database Connection Tests', () => {
  test('should connect to database', async () => {
    const connected = await DatabaseService.testConnection();
    expect(connected).toBe(true);
  });

  test('should get current season', async () => {
    const season = await DatabaseService.getCurrentSeason();
    expect(season).toBeTruthy();
    expect(season.id).toBe('fall-2025');
    expect(season.name).toBe('Fall 2025');
    expect(season.is_current).toBe(true);
  });

  test('should get divisions', async () => {
    const divisions = await DatabaseService.getDivisions();
    expect(Array.isArray(divisions)).toBe(true);
    expect(divisions.length).toBe(9);
    
    // Check division structure
    const division = divisions[0];
    expect(division).toHaveProperty('id');
    expect(division).toHaveProperty('name');
    expect(division).toHaveProperty('season_id');
    expect(division.season_id).toBe('fall-2025');
  });

  test('should get divisions for specific season', async () => {
    const divisions = await DatabaseService.getDivisions('fall-2025');
    expect(Array.isArray(divisions)).toBe(true);
    expect(divisions.length).toBe(9);
  });

  test('should handle empty results gracefully', async () => {
    const divisions = await DatabaseService.getDivisions('nonexistent-season');
    expect(Array.isArray(divisions)).toBe(true);
    expect(divisions.length).toBe(0);
  });

  test('should get teams for division', async () => {
    // This will be empty initially, but should return array
    const teams = await DatabaseService.getTeams('517');
    expect(Array.isArray(teams)).toBe(true);
  });

  test('should get team schedule', async () => {
    // This will be empty initially, but should return array
    const schedule = await DatabaseService.getTeamSchedule('6097', '517');
    expect(Array.isArray(schedule)).toBe(true);
  });

  test('should log refresh operations', async () => {
    await expect(
      DatabaseService.logRefresh('test', '517', true, 5, null, 1000)
    ).resolves.not.toThrow();
  });

  test('should get latest refresh status', async () => {
    const refresh = await DatabaseService.getLatestRefresh('test', '517');
    expect(refresh).toBeTruthy();
    expect(refresh.data_type).toBe('test');
    expect(refresh.division_id).toBe('517');
  });
});

describe('Database Error Handling', () => {
  test('should handle connection errors gracefully', async () => {
    // Mock a connection error
    const originalEnv = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'invalid-connection-string';
    
    const divisions = await DatabaseService.getDivisions();
    expect(Array.isArray(divisions)).toBe(true);
    expect(divisions.length).toBe(0);
    
    // Restore env
    process.env.DATABASE_URL = originalEnv;
  });
});