#!/usr/bin/env node

/**
 * Local Development Testing Script
 * 
 * This script allows you to test your API endpoints locally without
 * deploying to production every time.
 * 
 * Usage:
 *   node test-local.js [endpoint]
 * 
 * Examples:
 *   node test-local.js divisions
 *   node test-local.js teams 517
 *   node test-local.js scrape
 *   node test-local.js all
 */

const http = require('http');
const path = require('path');

// Set up test environment
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'your-database-url-here';

// Color output for better readability
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bold}${colors.blue}🚀 ${msg}${colors.reset}`)
};

// Test functions
const tests = {
  async divisions() {
    log.header('Testing Divisions API');
    try {
      const handler = require('./api/v2/divisions.js');
      const mockReq = {
        method: 'GET',
        query: { apiKey: 'mufa-public-2025' }
      };
      const mockRes = {
        status: (code) => ({ json: (data) => ({ statusCode: code, data }) }),
        setHeader: () => mockRes,
        json: (data) => ({ statusCode: 200, data })
      };

      const result = await handler.default(mockReq, mockRes);
      log.success(`Divisions API test completed`);
      return result;
    } catch (error) {
      log.error(`Divisions test failed: ${error.message}`);
      throw error;
    }
  },

  async teams(divisionId = '517') {
    log.header(`Testing Teams API for division ${divisionId}`);
    try {
      const handler = require('./api/v2/teams.js');
      const mockReq = {
        method: 'GET',
        query: { divisionId, apiKey: 'mufa-public-2025' }
      };
      const mockRes = {
        status: (code) => ({ json: (data) => ({ statusCode: code, data }) }),
        setHeader: () => mockRes,
        json: (data) => ({ statusCode: 200, data })
      };

      const result = await handler.default(mockReq, mockRes);
      log.success(`Teams API test completed for division ${divisionId}`);
      return result;
    } catch (error) {
      log.error(`Teams test failed: ${error.message}`);
      throw error;
    }
  },

  async scrape() {
    log.header('Testing Scraper (Safe Mode - No Database Changes)');
    try {
      // Mock the database service for safe testing
      const originalRequire = require;
      require = function(id) {
        if (id.includes('database/connection.js')) {
          return {
            DatabaseService: {
              getCurrentSeason: () => Promise.resolve({ id: 'test-2025', name: 'Test 2025' }),
              getDivisions: () => Promise.resolve([{ id: '517', name: 'Test Division' }]),
              logRefresh: () => Promise.resolve()
            }
          };
        }
        return originalRequire(id);
      };

      const handler = require('./api/cron/scrape-schedule.js');
      const mockReq = {
        method: 'GET',
        query: { admin: 'true', dryRun: 'true' }
      };
      const mockRes = {
        status: (code) => ({ json: (data) => ({ statusCode: code, data }) }),
        json: (data) => ({ statusCode: 200, data })
      };

      const result = await handler.default(mockReq, mockRes);
      log.success('Scraper test completed (dry run)');
      
      // Restore original require
      require = originalRequire;
      return result;
    } catch (error) {
      log.error(`Scraper test failed: ${error.message}`);
      throw error;
    }
  },

  async database() {
    log.header('Testing Database Connection');
    try {
      const { DatabaseService } = require('./api/_lib/database/connection.js');
      
      // Test basic connection
      const season = await DatabaseService.getCurrentSeason();
      if (season) {
        log.success(`Connected to database. Current season: ${season.name}`);
      } else {
        log.warn('Database connected but no current season found');
      }

      const divisions = await DatabaseService.getDivisions();
      log.success(`Found ${divisions.length} divisions`);

      return { season, divisionsCount: divisions.length };
    } catch (error) {
      log.error(`Database test failed: ${error.message}`);
      throw error;
    }
  }
};

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testName = args[0] || 'all';

  log.header(`🧪 Local API Testing Suite`);
  log.info(`Running test: ${testName}`);
  console.log('');

  try {
    if (testName === 'all') {
      await tests.database();
      await tests.divisions();
      await tests.teams();
      await tests.scrape();
      log.success('All tests completed successfully!');
    } else if (tests[testName]) {
      const extraArgs = args.slice(1);
      await tests[testName](...extraArgs);
      log.success(`${testName} test completed successfully!`);
    } else {
      log.error(`Unknown test: ${testName}`);
      log.info(`Available tests: ${Object.keys(tests).join(', ')}, all`);
      process.exit(1);
    }
  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { tests, log };