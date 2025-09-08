const cheerio = require('cheerio');

// Mock HTML responses for testing
const mockDivisionListHTML = `
<html>
<body>
  <a href="Team.aspx?t=6097&d=517">Team Alpha</a>
  <a href="Team.aspx?t=6098&d=517">Team Beta</a>
</body>
</html>
`;

const mockScheduleHTML = `
<html>
<body>
  <div class="clickable-row">
    <div>Sun, Sep-07</div>
    <div>6:00 PM</div>
    <div>Team Alpha</div>
    <div>Team Beta</div>
    <div>Burr Jones 1</div>
  </div>
</body>
</html>
`;

describe('MUFA Scraper Tests', () => {
  describe('Team Extraction', () => {
    test('should extract team information from HTML', () => {
      const $ = cheerio.load(mockDivisionListHTML);
      const teams = [];
      
      $('a[href*="Team.aspx?t="]').each((i, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        const name = $link.text().trim();
        
        const teamMatch = href.match(/[?&]t=(\d+)/);
        const divisionMatch = href.match(/[?&]d=(\d+)/);
        
        if (teamMatch && divisionMatch) {
          teams.push({
            id: teamMatch[1],
            name: name,
            divisionId: divisionMatch[1]
          });
        }
      });

      expect(teams).toHaveLength(2);
      expect(teams[0]).toEqual({
        id: '6097',
        name: 'Team Alpha',
        divisionId: '517'
      });
    });
  });

  describe('Schedule Extraction', () => {
    test('should extract game information from HTML', () => {
      const $ = cheerio.load(mockScheduleHTML);
      const games = [];
      
      $('.clickable-row').each((index, element) => {
        const $row = $(element);
        const cells = $row.find('div');
        
        if (cells.length >= 5) {
          games.push({
            date: $(cells[0]).text().trim(),
            time: $(cells[1]).text().trim(),
            teamA: $(cells[2]).text().trim(),
            teamB: $(cells[3]).text().trim(),
            field: $(cells[4]).text().trim()
          });
        }
      });

      expect(games).toHaveLength(1);
      expect(games[0]).toEqual({
        date: 'Sun, Sep-07',
        time: '6:00 PM',
        teamA: 'Team Alpha',
        teamB: 'Team Beta',
        field: 'Burr Jones 1'
      });
    });

    test('should handle date parsing', () => {
      const dateStr = 'Sun, Sep-07 6:00 PM';
      const year = new Date().getFullYear();
      
      // Basic date parsing logic (simplified)
      const [datePart, timePart] = dateStr.split(' ').slice(1).join(' ').split(' ');
      expect(datePart).toBe('Sep-07');
      expect(timePart).toBe('6:00');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed HTML gracefully', () => {
      const malformedHTML = '<html><body><div>broken</body>';
      const $ = cheerio.load(malformedHTML);
      
      const teams = [];
      $('a[href*="Team.aspx?t="]').each((i, element) => {
        teams.push($(element).text());
      });
      
      expect(teams).toHaveLength(0);
    });

    test('should handle missing elements', () => {
      const emptyHTML = '<html><body></body></html>';
      const $ = cheerio.load(emptyHTML);
      
      const games = [];
      $('.clickable-row').each((index, element) => {
        games.push($(element).text());
      });
      
      expect(games).toHaveLength(0);
    });
  });
});

describe('Field Information Extraction', () => {
  const mockFieldHTML = `
    <html>
    <body>
      <p>1820 E Washington Ave, Madison, WI 53704</p>
      <a href="https://maps.google.com/search/burr+jones">Map</a>
      <img src="/uploads/1/parks/burrjones.jpg" alt="Field Diagram">
    </body>
    </html>
  `;

  test('should extract field address', () => {
    const $ = cheerio.load(mockFieldHTML);
    const addressPattern = /\d+\s+[^,]+,\s*Madison,\s*WI\s*\d{5}/;
    const pageText = $('body').text();
    const addressMatch = pageText.match(addressPattern);
    
    expect(addressMatch).toBeTruthy();
    expect(addressMatch[0]).toBe('1820 E Washington Ave, Madison, WI 53704');
  });

  test('should extract map URL', () => {
    const $ = cheerio.load(mockFieldHTML);
    let mapUrl = null;
    
    $('a[href*="maps.google"]').each((i, element) => {
      mapUrl = $(element).attr('href');
    });
    
    expect(mapUrl).toBe('https://maps.google.com/search/burr+jones');
  });

  test('should extract diagram URL', () => {
    const $ = cheerio.load(mockFieldHTML);
    let diagramUrl = null;
    
    $('img[src*="parks"]').each((i, element) => {
      const src = $(element).attr('src');
      if (src && src.includes('parks')) {
        diagramUrl = src;
      }
    });
    
    expect(diagramUrl).toBe('/uploads/1/parks/burrjones.jpg');
  });
});