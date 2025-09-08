import { load } from 'cheerio';
import { DatabaseService, sql } from '../_lib/database/connection.js';

const MUFA_BASE_URL = 'https://www.mufa.org';

export default async function handler(req, res) {
  // Verify this is a cron request or admin request
  const authHeader = req.headers.authorization;
  const isValidCron = authHeader && authHeader.includes('Bearer cron-');
  const isAdminRequest = req.query.admin === 'true';
  
  if (!isValidCron && !isAdminRequest) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log('🏟️ Starting field data scraping...');

  try {
    // Get current season divisions
    const currentSeason = await DatabaseService.getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No current season found in database');
    }

    const divisions = await DatabaseService.getDivisions(currentSeason.id);
    console.log(`📋 Found ${divisions.length} divisions to scrape fields from`);

    let totalFieldsUpdated = 0;
    const fieldsProcessed = new Set();

    // Scrape fields from each division
    for (const division of divisions) {
      console.log(`🔍 Scraping fields for division: ${division.name} (${division.id})`);
      
      try {
        const divisionFields = await scrapeDivisionFields(division.id);
        
        for (const field of divisionFields) {
          if (!fieldsProcessed.has(field.id)) {
            await storeFieldData(field);
            fieldsProcessed.add(field.id);
            totalFieldsUpdated++;
          }
        }
        
        console.log(`✅ Found ${divisionFields.length} fields in division ${division.id}`);
        
      } catch (divisionError) {
        console.error(`❌ Error scraping fields for division ${division.id}:`, divisionError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Field scraping completed in ${duration}ms. Total fields updated: ${totalFieldsUpdated}`);

    // Log successful refresh
    await DatabaseService.logRefresh('fields', null, true, totalFieldsUpdated, null, duration);

    return res.status(200).json({
      success: true,
      duration,
      fieldsUpdated: totalFieldsUpdated,
      fieldsProcessed: Array.from(fieldsProcessed)
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Field scraping failed:', error);
    
    await DatabaseService.logRefresh('fields', null, false, 0, error.message, duration);
    
    return res.status(500).json({
      success: false,
      duration,
      error: error.message
    });
  }
}

async function scrapeDivisionFields(divisionId) {
  console.log(`🏟️ Fetching field list for division ${divisionId}...`);
  
  const response = await fetch(`${MUFA_BASE_URL}/League/Division/FieldList.aspx?d=${divisionId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch field list for division ${divisionId}: ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  const fields = [];

  // Find field links
  $('a[href*="Field.aspx?f="]').each((i, element) => {
    const $link = $(element);
    const href = $link.attr('href');
    const name = $link.text().trim();
    
    if (href && name && name.length > 0) {
      const fieldMatch = href.match(/[?&]f=(\d+)/);
      if (fieldMatch) {
        const fieldId = fieldMatch[1];
        fields.push({
          mufa_id: fieldId,
          name: name,
          href: href
        });
      }
    }
  });

  console.log(`📍 Found ${fields.length} fields in division ${divisionId}`);

  // Get detailed info for each field
  const detailedFields = [];
  for (const field of fields) {
    try {
      const fieldDetails = await scrapeFieldDetails(field, divisionId);
      detailedFields.push(fieldDetails);
    } catch (fieldError) {
      console.error(`❌ Error scraping field ${field.name}:`, fieldError);
      // Add basic field info even if detailed scraping fails
      detailedFields.push({
        id: field.name.toLowerCase().replace(/\s+/g, '-'),
        mufa_id: field.mufa_id,
        name: field.name,
        address: null,
        map_url: null,
        diagram_url: null,
        notes: `Error scraping details: ${fieldError.message}`
      });
    }
  }

  return detailedFields;
}

async function scrapeFieldDetails(field, divisionId) {
  console.log(`🔍 Scraping details for field: ${field.name}`);
  
  const fieldUrl = `${MUFA_BASE_URL}/League/Division/Field.aspx?f=${field.mufa_id}&d=${divisionId}`;
  const response = await fetch(fieldUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch field details: ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);

  const fieldDetails = {
    id: field.name.toLowerCase().replace(/\s+/g, '-'),
    mufa_id: field.mufa_id,
    name: field.name,
    address: null,
    map_url: null,
    diagram_url: null,
    parking_info: null,
    notes: null
  };

  // Extract address - look for patterns like "1820 E Washington Ave, Madison, WI 53704"
  const addressPattern = /\d+\s+[^,]+,\s*Madison,\s*WI\s*\d{5}/;
  const pageText = $('body').text();
  const addressMatch = pageText.match(addressPattern);
  if (addressMatch) {
    fieldDetails.address = addressMatch[0].trim();
    // Create Google Maps URL from address
    fieldDetails.map_url = `https://maps.google.com/search/${encodeURIComponent(fieldDetails.address)}`;
  }

  // Look for Google Maps links
  $('a[href*="maps.google"], a[href*="goo.gl/maps"]').each((i, element) => {
    const mapUrl = $(element).attr('href');
    if (mapUrl && !fieldDetails.map_url) {
      fieldDetails.map_url = mapUrl;
    }
  });

  // Look for field diagram images - patterns like "/uploads/1/parks/burrjones.jpg"
  $('img[src*="/uploads/"], img[src*="parks"], a[href*=".jpg"], a[href*=".png"]').each((i, element) => {
    const src = $(element).attr('src') || $(element).attr('href');
    if (src && (src.includes('parks') || src.includes('field') || src.includes('diagram'))) {
      fieldDetails.diagram_url = src.startsWith('http') ? src : `${MUFA_BASE_URL}${src}`;
    }
  });

  // Look for parking information
  const parkingKeywords = ['parking', 'park', 'lot', 'street'];
  $('*').each((i, element) => {
    const text = $(element).text().toLowerCase();
    if (parkingKeywords.some(keyword => text.includes(keyword)) && text.length < 200) {
      if (!fieldDetails.parking_info && text.includes('park')) {
        fieldDetails.parking_info = $(element).text().trim();
      }
    }
  });

  // If no map URL found, create one from field name
  if (!fieldDetails.map_url) {
    fieldDetails.map_url = `https://maps.google.com/search/${encodeURIComponent(field.name + ' Madison WI')}`;
  }

  console.log(`✅ Scraped details for ${field.name}: address=${!!fieldDetails.address}, map=${!!fieldDetails.map_url}, diagram=${!!fieldDetails.diagram_url}`);
  
  return fieldDetails;
}

async function storeFieldData(field) {
  try {
    await sql`
      INSERT INTO fields (
        id, mufa_id, name, address, map_url, diagram_url, parking_info, notes
      )
      VALUES (
        ${field.id}, ${field.mufa_id}, ${field.name}, ${field.address}, 
        ${field.map_url}, ${field.diagram_url}, ${field.parking_info}, ${field.notes}
      )
      ON CONFLICT (id) DO UPDATE SET
        mufa_id = EXCLUDED.mufa_id,
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        map_url = EXCLUDED.map_url,
        diagram_url = EXCLUDED.diagram_url,
        parking_info = EXCLUDED.parking_info,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `;
    
    console.log(`💾 Stored field: ${field.name}`);
  } catch (error) {
    console.error(`❌ Error storing field ${field.name}:`, error);
    throw error;
  }
}