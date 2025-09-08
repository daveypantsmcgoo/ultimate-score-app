# MUFA Ultimate Score App - Test Suite

## 🧪 Comprehensive Testing Setup

This test suite provides complete coverage for the MUFA Ultimate Score App backend.

## 📁 Test Structure

```
tests/
├── api/                    # API endpoint tests
│   ├── divisions.test.js   # /api/v2/divisions
│   ├── teams.test.js       # /api/v2/teams  
│   └── schedule.test.js    # /api/v2/schedule
├── database/               # Database layer tests
│   └── connection.test.js  # DatabaseService tests
├── integration/            # Full flow tests
│   └── full-flow.test.js   # End-to-end scenarios
├── scraper/                # Web scraper tests
│   └── mufa-scraper.test.js # HTML parsing tests
├── setup.js                # Test utilities & mocks
└── README.md               # This file
```

## 🚀 Running Tests

### Install Test Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
npm run test:api         # API endpoint tests only
npm run test:database    # Database tests only
npm run test:integration # Integration tests only
```

### Watch Mode (Auto-rerun on changes)
```bash
npm run test:watch
```

### Local Development Server
```bash
npm run dev              # Start local Vercel dev server on localhost:3000
```

## 🎯 Test Categories

### 1. **Unit Tests**
- Individual function testing
- Mock external dependencies
- Fast execution

### 2. **Integration Tests** 
- Database + API together
- Real environment testing
- End-to-end user flows

### 3. **Performance Tests**
- Response time validation  
- Concurrent request handling
- Database query efficiency

### 4. **Scraper Tests**
- HTML parsing validation
- Error handling
- Data extraction accuracy

## 📊 Test Coverage

Run with coverage reporting:
```bash
npm test -- --coverage
```

Expected coverage targets:
- **Functions**: >90%
- **Lines**: >85%
- **Branches**: >80%

## 🔧 Local Testing Workflow

### 1. Start Local Development
```bash
npm run dev
# Server runs on http://localhost:3000
```

### 2. Test API Endpoints Locally
```bash
# Test divisions
curl "http://localhost:3000/api/v2/divisions?apiKey=mufa-public-2025"

# Test teams
curl "http://localhost:3000/api/v2/teams?divisionId=517&apiKey=mufa-public-2025"

# Test manual refresh
curl -X POST "http://localhost:3000/api/v2/refresh" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: mufa-public-2025" \\
  -d '{"teamId": "6097", "divisionId": "517"}'
```

### 3. Run Tests Against Local Server
```bash
TEST_BASE_URL=http://localhost:3000 npm run test:integration
```

## 🐛 Debugging Tests

### View Test Output
```bash
npm test -- --verbose
```

### Debug Specific Test
```bash
npm test -- --testNamePattern="should return divisions"
```

### Test Database Connection
```bash
npm run test:database -- --verbose
```

## 📝 Writing New Tests

### API Endpoint Test Template
```javascript
describe('API: /api/v2/new-endpoint', () => {
  test('should handle successful request', async () => {
    const response = await request(app)
      .get('/api/v2/new-endpoint?apiKey=mufa-public-2025')
      .expect(200);
    
    expect(response.body).toBeDefined();
  });
});
```

### Database Test Template
```javascript
describe('Database: New Function', () => {
  test('should return expected data', async () => {
    const result = await DatabaseService.newFunction();
    expect(Array.isArray(result)).toBe(true);
  });
});
```

## 🔍 Monitoring & Alerts

Tests automatically run on:
- Every git push (via GitHub Actions)
- Before deployments
- Scheduled daily runs

## 📈 Performance Benchmarks

Expected response times:
- **Divisions API**: <200ms
- **Teams API**: <300ms  
- **Schedule API**: <500ms
- **Manual Refresh**: <5000ms

## 🚨 Common Test Failures

### Database Connection Issues
```bash
# Check environment variables
echo $DATABASE_URL

# Test database connectivity
npm run test:database
```

### API Authentication Errors
```bash
# Verify API key in test
grep -r "mufa-public-2025" tests/
```

### Scraper Test Failures
```bash
# Test HTML parsing
npm test -- tests/scraper/
```

## 🎉 Success Criteria

All tests passing means:
✅ Database connectivity working  
✅ All API endpoints responding correctly  
✅ Authentication functioning  
✅ Data scraping logic validated  
✅ Performance targets met  
✅ Error handling robust