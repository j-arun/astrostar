-- ===============================================================================
-- TARGET POSTGRESQL SCHEMA SPECIFICATION: VEDIC ASTROLOGY HOROSCOPE
-- ===============================================================================

CREATE TABLE IF NOT EXISTS person_master (
    person_id VARCHAR(50) PRIMARY KEY,
    person_name VARCHAR(100),
    age INTEGER,
    date_of_birth DATE,
    place_of_birth VARCHAR(100),
    birth_lagna VARCHAR(50),
    birth_rashi VARCHAR(50),
    birth_star VARCHAR(50),
    birth_star_pada INTEGER,
    starting_dasha_lord VARCHAR(50),
    dasha_balance_years INTEGER,
    dasha_balance_months INTEGER,
    dasha_balance_days INTEGER,
    dasha_balance_text VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS natal_placement_detail (
    id SERIAL PRIMARY KEY,
    person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
    chart_type VARCHAR(10) NOT NULL, -- 'D1' or 'D9'
    body_name VARCHAR(50) NOT NULL,  -- Standardized English (e.g. 'Sun (Surya)', 'Lagna')
    rashi_name VARCHAR(50) NOT NULL, -- Standardized Sign (e.g. 'Mesham (Aries)', 'Dhanus (Sagittarius)')
    house_number INTEGER NOT NULL CHECK (house_number BETWEEN 1 AND 12), -- 1 to 12 clockwise relative to Lagna
    nakshatra_name VARCHAR(50),
    pada INTEGER,
    degree_sputa VARCHAR(20),
    is_retrograde BOOLEAN DEFAULT FALSE,
    CONSTRAINT uq_natal_person_chart_body UNIQUE (person_id, chart_type, body_name)
);

CREATE TABLE IF NOT EXISTS vimshottari_dasha_detail (
    id SERIAL PRIMARY KEY,
    person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
    mahadasha_lord VARCHAR(50) NOT NULL,
    antardasha_lord VARCHAR(50) NOT NULL,
    pratyantardasha_lord VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rating_score VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_natal_person_chart ON natal_placement_detail(person_id, chart_type);
CREATE INDEX IF NOT EXISTS idx_natal_house ON natal_placement_detail(person_id, chart_type, house_number);
CREATE INDEX IF NOT EXISTS idx_dasha_person_dates ON vimshottari_dasha_detail(person_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_dasha_lords ON vimshottari_dasha_detail(person_id, mahadasha_lord, antardasha_lord);

-- ===============================================================================
-- D. TABLE: user_queries (Transaction audit table with 1 to 100 cycling sequence)
-- ===============================================================================
CREATE SEQUENCE IF NOT EXISTS user_query_seq
    MINVALUE 1
    MAXVALUE 100
    START WITH 1
    INCREMENT BY 1
    CYCLE;

CREATE TABLE IF NOT EXISTS user_queries (
    id SERIAL PRIMARY KEY,
    query_id VARCHAR(50) UNIQUE NOT NULL,      -- e.g., 'Q-001ME-042-20260928181500'
    running_number INTEGER NOT NULL,           -- Cycling unique number 1 to 100
    person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_queries_person ON user_queries(person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_queries_running ON user_queries(running_number);

