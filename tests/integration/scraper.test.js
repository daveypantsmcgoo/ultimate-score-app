const request = require('supertest');
const express = require('express');
const scraperHandler = require('../../api/cron/scrape-schedule.js');

// Mock the database service
jest.mock('../../api/_lib/database/connection.js', () => ({
  DatabaseService: {
    getCurrentSeason: jest.fn(),
    getDivisions: jest.fn(),
    logRefresh: jest.fn()
  }
}));

const { DatabaseService } = require('../../api/_lib/database/connection.js');

// Create test app
const app = express();
app.use(express.json());
app.get('/api/cron/scrape-schedule', (req, res) => scraperHandler.default(req, res));

describe('Integration: Scraper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful season and divisions
    DatabaseService.getCurrentSeason.mockResolvedValue({
      id: 'fall-2025',
      name: 'Fall 2025',
      is_current: true
    });
    DatabaseService.getDivisions.mockResolvedValue([
      { id: '517', name: 'Sun - FMP', season_id: 'fall-2025' }
    ]);
  });

  test('should handle successful scraping', async () => {
    // Mock successful HTTP requests
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><div>Mock teams data</div></html>')
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(`
          <table>
            <tr class="clickable-row">
              <td>Sun, Sep-07</td>
              <td>6:00 PM</td>
              <td>vs Team A</td>
              <td>Burr Jones 1</td>
            </tr>
          </table>
        `)
      });

    const response = await request(app)
      .get('/api/cron/scrape-schedule?admin=true')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.divisionsProcessed).toBe(1);
    expect(DatabaseService.logRefresh).toHaveBeenCalled();
  });

  test('should handle no current season', async () => {
    DatabaseService.getCurrentSeason.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/cron/scrape-schedule?admin=true')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('No current season found in database');
  });

  test('should handle getTeams returning undefined (postgres package compatibility)', async () => {
    // Mock the exact issue we had in production
    const mockGetTeams = jest.fn().mockResolvedValue(undefined);
    
    // Replace the actual DatabaseService method
    const originalGetTeams = DatabaseService.getTeams;
    DatabaseService.getTeams = mockGetTeams;

    const response = await request(app)
      .get('/api/cron/scrape-schedule?admin=true')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.results).toBeDefined();
    
    // Should show the "Cannot read properties of undefined (reading 'length')" error in results
    Object.values(response.body.results).forEach(result => {
      expect(result.error).toContain('Cannot read properties of undefined');
    });

    // Restore original method
    DatabaseService.getTeams = originalGetTeams;
  });

  test('should handle HTTP errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const response = await request(app)
      .get('/api/cron/scrape-schedule?admin=true')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Network error');
  });

  test('should require admin parameter', async () => {
    const response = await request(app)
      .get('/api/cron/scrape-schedule')
      .expect(403);

    expect(response.body.error).toBe('Admin access required');
  });

  test('should handle empty divisions', async () => {
    DatabaseService.getDivisions.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/cron/scrape-schedule?admin=true')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.divisionsProcessed).toBe(0);
    expect(response.body.message).toContain('No divisions found');
  });

  test('should track processing duration', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html></html>')
    });

    const response = await request(app)
      .get('/api/cron/scrape-schedule?admin=true')
      .expect(200);

    expect(response.body).toHaveProperty('duration');
    expect(typeof response.body.duration).toBe('number');
    expect(response.body.duration).toBeGreaterThan(0);
  });
});

describe('Integration: Local Development', () => {
  test('should work with vercel dev', async () => {
    // Test that our API structure works with local development
    expect(scraperHandler.default).toBeInstanceOf(Function);
    
    const mockReq = testUtils.mockRequest({
      method: 'GET',
      query: { admin: 'true' }
    });
    const mockRes = testUtils.mockResponse();

    DatabaseService.getCurrentSeason.mockResolvedValue({
      id: 'fall-2025',
      name: 'Fall 2025'
    });
    DatabaseService.getDivisions.mockResolvedValue([]);

    await scraperHandler.default(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalled();
  });
});