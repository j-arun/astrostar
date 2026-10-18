ALTER TABLE vimshottari_dasha_detail
    ADD COLUMN IF NOT EXISTS notes VARCHAR(200),
    ADD COLUMN IF NOT EXISTS evaluation_rating SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
                WHERE conname = 'chk_vimshottari_evaluation_rating'
                    AND conrelid = 'vimshottari_dasha_detail'::regclass
    ) THEN
        ALTER TABLE vimshottari_dasha_detail
            ADD CONSTRAINT chk_vimshottari_evaluation_rating
            CHECK (evaluation_rating IS NULL OR evaluation_rating IN (0, 5, 10));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vimshottari_dasha_period
    ON vimshottari_dasha_detail (
        person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date
    );