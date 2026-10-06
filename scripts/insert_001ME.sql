-- ===============================================================================
-- Vedic Astrology Horoscope PostgreSQL Dump
-- Generated for ID: 001ME at 2026-09-29T01:21:49.244704
-- ===============================================================================
BEGIN;

INSERT INTO person_master (
    person_id, person_name, age, date_of_birth, place_of_birth,
    birth_lagna, birth_rashi, birth_star, birth_star_pada,
    starting_dasha_lord, dasha_balance_years, dasha_balance_months,
    dasha_balance_days, dasha_balance_text
) VALUES (
    '001ME', 'ME', 50,
    '1976-01-26', 'Tamil Nadu, India',
    'Dhanus (Sagittarius)', 'Vrischigam (Scorpio)', 'Anusham (Anuradha)', 2,
    'Saturn (Sani)', 13, 2,
    5, '13-வருஷம் 2-மாதம் 5-நாள் 31-நாழி 47-விநாடி'
) ON CONFLICT (person_id) DO NOTHING;

-- Natal Placements (D1 & D9 with clockwise Lagna house numbering)
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Lagna', 'Dhanus (Sagittarius)', 1, 'Purva Ashadha', 1, '16° 33'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Venus (Sukra)', 'Dhanus (Sagittarius)', 1, 'Mula', 2, '06° 08'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Sun (Surya)', 'Makaram (Capricorn)', 2, 'Shravana', 1, '11° 37'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Mercury (Budha)', 'Makaram (Capricorn)', 2, 'Uttara Ashadha', 3, '05° 15'', TRUE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Jupiter (Guru)', 'Meenam (Pisces)', 4, 'Revathi', 3, '24° 42'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Ketu', 'Mesham (Aries)', 5, 'Bharani', 4, '24° 25'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Mars (Sevvai)', 'Rishabam (Taurus)', 6, 'Rohini', 4, '21° 23'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Saturn (Sani)', 'Katakam (Cancer)', 8, 'Pushya', 1, '05° 57'', TRUE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Mandi (Gulika)', 'Kanni (Virgo)', 10, 'Hasta', 2, '14° 42'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Rahu', 'Thulaam (Libra)', 11, 'Vishakha', 2, '24° 25'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D1', 'Moon (Chandra)', 'Vrischigam (Scorpio)', 12, 'Anuradha', 2, '07° 24'', FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Lagna', 'Simham (Leo)', 1, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Saturn (Sani)', 'Simham (Leo)', 1, NULL, NULL, NULL, TRUE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Moon (Chandra)', 'Kanni (Virgo)', 2, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Ketu', 'Vrischigam (Scorpio)', 4, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Mercury (Budha)', 'Kumbam (Aquarius)', 7, NULL, NULL, NULL, TRUE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Jupiter (Guru)', 'Kumbam (Aquarius)', 7, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Sun (Surya)', 'Mesham (Aries)', 9, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Venus (Sukra)', 'Rishabam (Taurus)', 10, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Mandi (Gulika)', 'Rishabam (Taurus)', 10, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Rahu', 'Mithunam (Gemini)', 11, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;
INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde) VALUES ('001ME', 'D9', 'Mars (Sevvai)', 'Katakam (Cancer)', 12, NULL, NULL, NULL, FALSE) ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET house_number = EXCLUDED.house_number;

-- Vimshottari Dasha Records
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Ketu', 'Venus (Sukra)', '1976-01-26', '1976-03-14');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Ketu', 'Sun (Surya)', '1976-03-14', '1976-04-04');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Ketu', 'Moon (Chandra)', '1976-04-04', '1976-05-07');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Ketu', 'Mars (Sevvai)', '1976-05-07', '1976-05-30');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Ketu', 'Rahu', '1976-05-30', '1976-07-30');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Ketu', 'Jupiter (Guru)', '1976-07-30', '1976-09-23');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Ketu', 'Saturn (Sani)', '1976-09-23', '1976-11-27');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Ketu', 'Mercury (Budha)', '1976-11-27', '1977-01-23');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Venus (Sukra)', '1977-01-23', '1977-08-03');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Sun (Surya)', '1977-08-03', '1977-09-30');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Moon (Chandra)', '1977-09-30', '1978-01-05');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Mars (Sevvai)', '1978-01-05', '1978-03-12');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Rahu', '1978-03-12', '1978-09-03');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Jupiter (Guru)', '1978-09-03', '1979-02-05');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Saturn (Sani)', '1979-02-05', '1979-08-05');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Mercury (Budha)', '1979-08-05', '1980-01-17');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Venus (Sukra)', 'Ketu', '1980-01-17', '1980-03-23');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Sun (Surya)', '1980-03-23', '1980-04-10');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Moon (Chandra)', '1980-04-10', '1980-05-09');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Mars (Sevvai)', '1980-05-09', '1980-05-29');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Rahu', '1980-05-29', '1980-07-20');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Jupiter (Guru)', '1980-07-20', '1980-09-05');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Saturn (Sani)', '1980-09-05', '1980-10-30');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Mercury (Budha)', '1980-10-30', '1980-12-18');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Ketu', '1980-12-18', '1981-01-08');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Saturn (Sani)', 'Sun (Surya)', 'Venus (Sukra)', '1981-01-08', '1981-03-05');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Mercury (Budha)', 'Mercury (Budha)', 'Mercury (Budha)', '1989-04-02', '1989-08-05');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Mercury (Budha)', 'Mercury (Budha)', 'Ketu', '1989-08-05', '1989-09-25');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Mercury (Budha)', 'Mercury (Budha)', 'Venus (Sukra)', '1989-09-25', '1990-02-20');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Ketu', 'Ketu', 'Ketu', '2006-04-02', '2006-04-11');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Ketu', 'Ketu', 'Venus (Sukra)', '2006-04-11', '2006-05-05');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Venus (Sukra)', 'Venus (Sukra)', 'Venus (Sukra)', '2013-04-02', '2013-10-22');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Venus (Sukra)', 'Venus (Sukra)', 'Sun (Surya)', '2013-10-22', '2013-12-22');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Sun (Surya)', 'Sun (Surya)', 'Sun (Surya)', '2033-04-02', '2033-04-07');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Moon (Chandra)', 'Moon (Chandra)', 'Moon (Chandra)', '2039-04-02', '2039-04-27');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Mars (Sevvai)', 'Mars (Sevvai)', 'Mars (Sevvai)', '2049-04-02', '2049-04-11');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Rahu', 'Rahu', 'Rahu', '2056-04-02', '2056-08-28');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Jupiter (Guru)', 'Jupiter (Guru)', 'Jupiter (Guru)', '2074-04-02', '2074-07-14');
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date) VALUES ('001ME', 'Jupiter (Guru)', 'Rahu', 'Mars (Sevvai)', '2090-02-12', '2090-04-02');

COMMIT;
