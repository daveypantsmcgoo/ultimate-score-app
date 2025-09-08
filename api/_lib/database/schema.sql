-- MUFA Ultimate Frisbee Database Schema
-- Designed for Vercel Postgres

-- Seasons table - tracks different seasons/years
CREATE TABLE seasons (
    id VARCHAR(50) PRIMARY KEY,           -- e.g., 'fall-2025'
    name VARCHAR(100) NOT NULL,           -- e.g., 'Fall 2025'
    is_current BOOLEAN DEFAULT FALSE,     -- only one season should be current
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Divisions table - different leagues within a season
CREATE TABLE divisions (
    id VARCHAR(50) PRIMARY KEY,           -- MUFA division ID e.g., '517'
    season_id VARCHAR(50) REFERENCES seasons(id),
    name VARCHAR(200) NOT NULL,           -- e.g., 'Sun - FMP'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table - teams within divisions
CREATE TABLE teams (
    id VARCHAR(50) PRIMARY KEY,           -- MUFA team ID e.g., '6097'
    division_id VARCHAR(50) REFERENCES divisions(id),
    name VARCHAR(200) NOT NULL,           -- e.g., 'Dryad'
    jersey_color VARCHAR(100),            -- e.g., 'Neon Pink'
    captain_info JSONB,                   -- Store captain details if available
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fields table - playing locations
CREATE TABLE fields (
    id VARCHAR(50) PRIMARY KEY,           -- e.g., 'burr-jones-1'
    mufa_id VARCHAR(50),                  -- MUFA's field ID
    name VARCHAR(200) NOT NULL,           -- e.g., 'Burr Jones 1'
    address TEXT,
    map_url TEXT,                         -- Google Maps link
    diagram_url TEXT,                     -- Field diagram image
    coordinates JSONB,                    -- {lat, lng} if available
    parking_info TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table - individual games/matches
CREATE TABLE games (
    id VARCHAR(100) PRIMARY KEY,          -- e.g., 'game-517-6097-20250907'
    division_id VARCHAR(50) REFERENCES divisions(id),
    team_a_id VARCHAR(50) REFERENCES teams(id),
    team_b_id VARCHAR(50) REFERENCES teams(id),
    field_id VARCHAR(50) REFERENCES fields(id),
    
    -- Game details
    game_date DATE NOT NULL,
    game_time TIME,
    game_datetime TIMESTAMP WITH TIME ZONE, -- Combined date/time
    
    -- Game status
    is_complete BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    
    -- Scores (NULL if not played yet)
    team_a_score INTEGER,
    team_b_score INTEGER,
    
    -- Jersey colors for this specific game
    team_a_jersey VARCHAR(50),            -- e.g., 'Dark', 'White'
    team_b_jersey VARCHAR(50),
    
    -- Additional game info
    game_number INTEGER,                  -- e.g., week 1, 2, 3...
    game_type VARCHAR(50) DEFAULT 'regular', -- 'regular', 'playoff', 'championship'
    notes TEXT,
    
    -- Metadata
    mufa_game_id VARCHAR(50),             -- MUFA's internal game ID if available
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data refresh tracking
CREATE TABLE data_refresh_log (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,       -- 'divisions', 'teams', 'games', 'fields'
    division_id VARCHAR(50),              -- NULL for season-wide refreshes
    refresh_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    refresh_completed_at TIMESTAMP WITH TIME ZONE,
    records_updated INTEGER DEFAULT 0,
    success BOOLEAN,
    error_message TEXT,
    duration_ms INTEGER
);

-- Indexes for performance
CREATE INDEX idx_divisions_season ON divisions(season_id);
CREATE INDEX idx_teams_division ON teams(division_id);
CREATE INDEX idx_games_division ON games(division_id);
CREATE INDEX idx_games_teams ON games(team_a_id, team_b_id);
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_datetime ON games(game_datetime);
CREATE INDEX idx_refresh_log_type_time ON data_refresh_log(data_type, refresh_started_at);

-- Initial season data
INSERT INTO seasons (id, name, is_current, start_date) VALUES 
('fall-2025', 'Fall 2025', TRUE, '2025-09-01');

-- Initial divisions for Fall 2025
INSERT INTO divisions (id, season_id, name) VALUES 
('517', 'fall-2025', 'Sun - FMP'),
('518', 'fall-2025', 'Sun - MMP'),
('519', 'fall-2025', 'Mon (Early Bird) - Mixed'),
('520', 'fall-2025', 'Mon (Night Owl) - Open'),
('521', 'fall-2025', 'Tues - Mixed'),
('522', 'fall-2025', 'Thurs - Mixed'),
('523', 'fall-2025', 'Mon/Wed - Mixed'),
('524', 'fall-2025', 'Tues/Thurs - Mixed'),
('525', 'fall-2025', 'Fall Sub Only');