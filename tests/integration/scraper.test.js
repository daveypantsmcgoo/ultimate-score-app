const request = require('supertest');
const express = require('express');
const scraperHandler = require('../../api/cron/scrape-schedules-only.js');

// Mock the database service
jest.mock('../../api/_lib/database/connection.js', () => ({
  DatabaseService: {
    getCurrentSeason: jest.fn(),
    getDivisions: jest.fn(),
    logRefresh: jest.fn()
  },
  sql: {
    unsafe: jest.fn().mockResolvedValue([])
  }
}));

const { DatabaseService } = require('../../api/_lib/database/connection.js');

// Create test app
const app = express();
app.use(express.json());
app.get('/api/cron/scrape-schedules-only', (req, res) => scraperHandler.default(req, res));

describe('Integration: Scraper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful season and teams
    DatabaseService.getCurrentSeason.mockResolvedValue({
      id: 'fall-2025',
      name: 'Fall 2025',
      is_current: true
    });
    
    // Mock sql.unsafe to return teams
    const { sql } = require('../../api/_lib/database/connection.js');
    sql.unsafe.mockResolvedValue([
      { id: '3007', name: 'Harpy', division_id: '517', division_name: 'Sun - FMP' }
    ]);
  });

  test('should handle successful scraping', async () => {
    // Mock successful HTTP requests with real MUFA HTML structure
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`
        <html>
          <body>
            <tr class="clickable-row top-level-row" data-toggle="collapse" data-target="#collapse0">
              <td>
                <div class="container-fluid">
                  <div class="row">
                    <div class="col-10">    
                      <div class="row tight-spacing">
                        <div class="col-8">
                          <strong>Tue, Jun-02 7:30 PM</strong>
                        </div>
                        <div class="col-4 text-center">
                          <strong>
                            <span data-toggle="tooltip" title="Lost">L (3-13)</span>
                          </strong>                                                                
                        </div>
                      </div>                                                    
                      <div class="row mt-1 tight-spacing">    
                        <div class="col-4 text-left">
                          <i class="fas fa-tshirt"></i> <i>(White)</i>
                        </div>                                                
                        <div class="col-8 text-right">
                          <a href='https://mufa.org/League/Division/Team.aspx?t=2591&d=138'>
                            Opponent Team
                          </a> 
                          <i>(Dark)</i>
                        </div>
                      </div>
                      <div class="row tight-spacing mt-1">
                        <div class="col-12">
                          Burr Jones Field 1
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </body>
        </html>
      `)
    });

    const response = await request(app)
      .get('/api/cron/scrape-schedules-only?admin=true')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.teamsProcessed).toBe(1);
    expect(response.body.totalGamesUpdated).toBeGreaterThan(0);
    expect(DatabaseService.logRefresh).toHaveBeenCalled();
  });

  test('should handle no current season', async () => {
    DatabaseService.getCurrentSeason.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/cron/scrape-schedules-only?admin=true')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('No current season found. Please run season setup first.');
  });

  test('should handle sql.unsafe returning undefined (postgres package compatibility)', async () => {
    // Mock the exact issue we had in production
    const { sql } = require('../../api/_lib/database/connection.js');
    sql.unsafe.mockResolvedValue(undefined);

    const response = await request(app)
      .get('/api/cron/scrape-schedules-only?admin=true')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Cannot read properties of undefined');
  });

  test('should handle HTTP errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const response = await request(app)
      .get('/api/cron/scrape-schedules-only?admin=true')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Network error');
  });

  test('should require admin parameter', async () => {
    const response = await request(app)
      .get('/api/cron/scrape-schedules-only')
      .expect(401);

    expect(response.body.error).toBe('Unauthorized');
  });

  test('should handle empty teams', async () => {
    // Mock sql.unsafe to return empty teams array
    const { sql } = require('../../api/_lib/database/connection.js');
    sql.unsafe.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/cron/scrape-schedules-only?admin=true')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('No teams found. Please run season setup first.');
  });

  test('should track processing duration', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html></html>')
    });

    const response = await request(app)
      .get('/api/cron/scrape-schedules-only?admin=true')
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
    
    // Create simple mock request/response objects
    const mockReq = {
      method: 'GET',
      query: { admin: 'true' },
      headers: {}
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    DatabaseService.getCurrentSeason.mockResolvedValue({
      id: 'fall-2025',
      name: 'Fall 2025'
    });
    
    // Mock sql.unsafe to return empty teams (will cause error)
    const { sql } = require('../../api/_lib/database/connection.js');
    sql.unsafe.mockResolvedValue([]);

    await scraperHandler.default(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalled();
  });
});