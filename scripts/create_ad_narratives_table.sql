-- ===============================================================================
-- AD_NARRATIVES TABLE SCHEMA
-- Comprehensive lived-experience narrative summary across 81 MD-AD combinations
-- ===============================================================================

CREATE TABLE IF NOT EXISTS ad_narratives (
    unique_id VARCHAR(64) PRIMARY KEY,
    person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
    md VARCHAR(30) NOT NULL,
    ad VARCHAR(30) NOT NULL,
    start_date VARCHAR(20),
    end_date VARCHAR(20),
    life_period VARCHAR(50),
    primary_domains TEXT,
    key_milestones TEXT,
    narrative TEXT,
    source_model VARCHAR(50) DEFAULT 'local_qwen',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for rapid lookups by person and Dasha periods
CREATE INDEX IF NOT EXISTS idx_ad_narratives_person_md_ad 
    ON ad_narratives (person_id, md, ad);

-- Automatic timestamp updater trigger
CREATE OR REPLACE FUNCTION update_ad_narratives_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ad_narratives_updated_at ON ad_narratives;
CREATE TRIGGER trg_ad_narratives_updated_at
    BEFORE UPDATE ON ad_narratives
    FOR EACH ROW
    EXECUTE FUNCTION update_ad_narratives_timestamp();

COMMENT ON TABLE ad_narratives IS 'Stores 81 MD-AD synthesis narratives, life period tags, and domain milestones for LLM reasoning and diary recall';
COMMENT ON COLUMN ad_narratives.unique_id IS 'Unique composite ID: {person_id}_{md}_{ad} e.g. 001ME_Venus_Ketu';
COMMENT ON COLUMN ad_narratives.life_period IS '1 of 10 human life stages (Infancy, Early Childhood, School Age, Adolescence, Early Youth, Prime Adulthood, Mid Adulthood, Mature Adulthood, Senior Elder, Twilight)';
COMMENT ON COLUMN ad_narratives.primary_domains IS 'Comma-separated multi-select life domains (Career, Finance, Health, Marriage, Children, Education, Relocation, Spiritual, Property, Legal)';
COMMENT ON COLUMN ad_narratives.key_milestones IS 'Concise bullet points or 1-2 sentence landmark summary of that AD';
COMMENT ON COLUMN ad_narratives.narrative IS 'Unlimited CLOB/TEXT containing the detailed synthesis narrative';
