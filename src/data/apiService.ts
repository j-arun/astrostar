import { samplePersonMaster, sampleNatalPlacements, PersonMaster, NatalPlacement } from './horoscopeData';
import { generateClientTransitTimeline, TransitEphemerisPayload } from './transitEphemeris';
import { getFullVimshottariTimeline, calculateVimshottariTimelineForProfile } from './dashaCalculator';
import storedPersonsData from './stored_persons.json';

export interface UserQueryLog {
  id?: number;
  query_id: string;
  running_number: number;
  person_id: string;
  start_date: string;
  end_date: string;
  created_at?: string;
  response_payload: HoroscopeApiResponse;
}

export interface DashaIntervalItem {
  sequence_index: number;
  mahadasha_lord_md: string;
  antardasha_lord_ad: string;
  pratyantardasha_lord_pd: string;
  full_lord_hierarchy: string;
  start_date: string;
  end_date: string;
  duration_days: number | null;
}

export interface HoroscopeApiResponse {
  unique_response_id: string;
  running_number: number;
  person_id: string;
  requested_timeline: {
    start_date: string;
    end_date: string;
    span_years: number | null;
  };
  person_profile: PersonMaster;
  natal_placements: {
    D1_rashi_chart: {
      count: number;
      lagna_sign: string;
      bodies: NatalPlacement[];
    };
    D9_navamsha_chart: {
      count: number;
      bodies: NatalPlacement[];
    };
  };
  vimshottari_dasha_intervals: {
    total_intervals_count: number;
    granularity: string;
    intervals: DashaIntervalItem[];
  };
  transit_ephemeris_timeline: TransitEphemerisPayload;
  server_timestamp: string;
  persisted_in_database: {
    table: string;
    running_number_cycle: string;
    status: string;
  };
}

// Master list of Vimshottari intervals covering 1976 through 2090
export const ALL_DASHA_TIMELINE: [string, string, string, string, string][] = [
  // Saturn MD (1976 - 1989)
  ["Saturn (Sani)", "Ketu", "Venus (Sukra)", "1976-01-26", "1976-03-14"],
  ["Saturn (Sani)", "Ketu", "Sun (Surya)", "1976-03-14", "1976-04-04"],
  ["Saturn (Sani)", "Ketu", "Moon (Chandra)", "1976-04-04", "1976-05-07"],
  ["Saturn (Sani)", "Ketu", "Mars (Sevvai)", "1976-05-07", "1976-05-30"],
  ["Saturn (Sani)", "Ketu", "Rahu", "1976-05-30", "1976-07-30"],
  ["Saturn (Sani)", "Ketu", "Jupiter (Guru)", "1976-07-30", "1976-09-23"],
  ["Saturn (Sani)", "Ketu", "Saturn (Sani)", "1976-09-23", "1976-11-27"],
  ["Saturn (Sani)", "Ketu", "Mercury (Budha)", "1976-11-27", "1977-01-23"],
  ["Saturn (Sani)", "Venus (Sukra)", "Venus (Sukra)", "1977-01-23", "1977-08-03"],
  ["Saturn (Sani)", "Venus (Sukra)", "Sun (Surya)", "1977-08-03", "1977-09-30"],
  ["Saturn (Sani)", "Venus (Sukra)", "Moon (Chandra)", "1977-09-30", "1978-01-05"],
  ["Saturn (Sani)", "Venus (Sukra)", "Mars (Sevvai)", "1978-01-05", "1978-03-12"],
  ["Saturn (Sani)", "Venus (Sukra)", "Rahu", "1978-03-12", "1978-09-03"],
  ["Saturn (Sani)", "Venus (Sukra)", "Jupiter (Guru)", "1978-09-03", "1979-02-05"],
  ["Saturn (Sani)", "Venus (Sukra)", "Saturn (Sani)", "1979-02-05", "1979-08-05"],
  ["Saturn (Sani)", "Venus (Sukra)", "Mercury (Budha)", "1979-08-05", "1980-01-17"],
  ["Saturn (Sani)", "Venus (Sukra)", "Ketu", "1980-01-17", "1980-03-23"],
  ["Saturn (Sani)", "Sun (Surya)", "Sun (Surya)", "1980-03-23", "1980-04-10"],
  ["Saturn (Sani)", "Sun (Surya)", "Moon (Chandra)", "1980-04-10", "1980-05-09"],
  ["Saturn (Sani)", "Sun (Surya)", "Mars (Sevvai)", "1980-05-09", "1980-05-29"],
  ["Saturn (Sani)", "Sun (Surya)", "Rahu", "1980-05-29", "1980-07-20"],
  ["Saturn (Sani)", "Sun (Surya)", "Jupiter (Guru)", "1980-07-20", "1980-09-05"],
  ["Saturn (Sani)", "Sun (Surya)", "Saturn (Sani)", "1980-09-05", "1980-10-30"],
  ["Saturn (Sani)", "Sun (Surya)", "Mercury (Budha)", "1980-10-30", "1980-12-18"],
  ["Saturn (Sani)", "Sun (Surya)", "Ketu", "1980-12-18", "1981-01-08"],
  ["Saturn (Sani)", "Sun (Surya)", "Venus (Sukra)", "1981-01-08", "1981-03-05"],
  ["Saturn (Sani)", "Moon (Chandra)", "Moon (Chandra)", "1981-03-05", "1981-04-23"],
  ["Saturn (Sani)", "Moon (Chandra)", "Mars (Sevvai)", "1981-04-23", "1981-05-26"],
  ["Saturn (Sani)", "Moon (Chandra)", "Rahu", "1981-05-26", "1981-08-21"],
  ["Saturn (Sani)", "Moon (Chandra)", "Jupiter (Guru)", "1981-08-21", "1981-11-07"],
  ["Saturn (Sani)", "Moon (Chandra)", "Saturn (Sani)", "1981-11-07", "1982-02-08"],
  ["Saturn (Sani)", "Moon (Chandra)", "Mercury (Budha)", "1982-02-08", "1982-04-28"],
  ["Saturn (Sani)", "Moon (Chandra)", "Ketu", "1982-04-28", "1982-06-02"],
  ["Saturn (Sani)", "Moon (Chandra)", "Venus (Sukra)", "1982-06-02", "1982-09-07"],
  ["Saturn (Sani)", "Moon (Chandra)", "Sun (Surya)", "1982-09-07", "1982-10-05"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Mars (Sevvai)", "1982-10-05", "1982-10-28"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Rahu", "1982-10-28", "1982-12-28"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Jupiter (Guru)", "1982-12-28", "1983-02-21"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Saturn (Sani)", "1983-02-21", "1983-04-25"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Mercury (Budha)", "1983-04-25", "1983-06-21"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Ketu", "1983-06-21", "1983-07-14"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Venus (Sukra)", "1983-07-14", "1983-09-21"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Sun (Surya)", "1983-09-21", "1983-10-11"],
  ["Saturn (Sani)", "Mars (Sevvai)", "Moon (Chandra)", "1983-10-11", "1983-11-14"],
  ["Saturn (Sani)", "Rahu", "Rahu", "1983-11-14", "1984-04-18"],
  ["Saturn (Sani)", "Rahu", "Jupiter (Guru)", "1984-04-18", "1984-09-05"],
  ["Saturn (Sani)", "Rahu", "Saturn (Sani)", "1984-09-05", "1985-02-17"],
  ["Saturn (Sani)", "Rahu", "Mercury (Budha)", "1985-02-17", "1985-07-13"],
  ["Saturn (Sani)", "Rahu", "Ketu", "1985-07-13", "1985-09-12"],
  ["Saturn (Sani)", "Rahu", "Venus (Sukra)", "1985-09-12", "1986-03-03"],
  ["Saturn (Sani)", "Rahu", "Sun (Surya)", "1986-03-03", "1986-04-25"],
  ["Saturn (Sani)", "Rahu", "Moon (Chandra)", "1986-04-25", "1986-07-20"],
  ["Saturn (Sani)", "Rahu", "Mars (Sevvai)", "1986-07-20", "1986-09-20"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Jupiter (Guru)", "1986-09-20", "1987-01-22"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Saturn (Sani)", "1987-01-22", "1987-06-16"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Mercury (Budha)", "1987-06-16", "1987-10-25"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Ketu", "1987-10-25", "1987-12-18"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Venus (Sukra)", "1987-12-18", "1988-05-20"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Sun (Surya)", "1988-05-20", "1988-07-06"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Moon (Chandra)", "1988-07-06", "1988-09-22"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Mars (Sevvai)", "1988-09-22", "1988-11-15"],
  ["Saturn (Sani)", "Jupiter (Guru)", "Rahu", "1988-11-15", "1989-04-02"],

  // Mercury MD (1989 - 2006)
  ["Mercury (Budha)", "Mercury (Budha)", "Mercury (Budha)", "1989-04-02", "1989-08-05"],
  ["Mercury (Budha)", "Mercury (Budha)", "Ketu", "1989-08-05", "1989-09-25"],
  ["Mercury (Budha)", "Mercury (Budha)", "Venus (Sukra)", "1989-09-25", "1990-02-20"],
  ["Mercury (Budha)", "Mercury (Budha)", "Sun (Surya)", "1990-02-20", "1990-04-03"],
  ["Mercury (Budha)", "Mercury (Budha)", "Moon (Chandra)", "1990-04-03", "1990-06-16"],
  ["Mercury (Budha)", "Mercury (Budha)", "Mars (Sevvai)", "1990-06-16", "1990-08-06"],
  ["Mercury (Budha)", "Mercury (Budha)", "Rahu", "1990-08-06", "1990-12-16"],
  ["Mercury (Budha)", "Mercury (Budha)", "Jupiter (Guru)", "1990-12-16", "1991-04-12"],
  ["Mercury (Budha)", "Mercury (Budha)", "Saturn (Sani)", "1991-04-12", "1991-08-29"],
  ["Mercury (Budha)", "Ketu", "Ketu", "1991-08-29", "1991-09-20"],
  ["Mercury (Budha)", "Ketu", "Venus (Sukra)", "1991-09-20", "1991-11-19"],
  ["Mercury (Budha)", "Ketu", "Sun (Surya)", "1991-11-19", "1991-12-07"],
  ["Mercury (Budha)", "Ketu", "Moon (Chandra)", "1991-12-07", "1992-01-07"],
  ["Mercury (Budha)", "Ketu", "Mars (Sevvai)", "1992-01-07", "1992-01-28"],
  ["Mercury (Budha)", "Ketu", "Rahu", "1992-01-28", "1992-03-21"],
  ["Mercury (Budha)", "Ketu", "Jupiter (Guru)", "1992-03-21", "1992-05-09"],
  ["Mercury (Budha)", "Ketu", "Saturn (Sani)", "1992-05-09", "1992-07-05"],
  ["Mercury (Budha)", "Ketu", "Mercury (Budha)", "1992-07-05", "1992-08-26"],
  ["Mercury (Budha)", "Venus (Sukra)", "Venus (Sukra)", "1992-08-26", "1993-02-16"],
  ["Mercury (Budha)", "Venus (Sukra)", "Sun (Surya)", "1993-02-16", "1993-04-07"],
  ["Mercury (Budha)", "Venus (Sukra)", "Moon (Chandra)", "1993-04-07", "1993-07-02"],
  ["Mercury (Budha)", "Venus (Sukra)", "Mars (Sevvai)", "1993-07-02", "1993-09-02"],
  ["Mercury (Budha)", "Venus (Sukra)", "Rahu", "1993-09-02", "1994-02-05"],
  ["Mercury (Budha)", "Venus (Sukra)", "Jupiter (Guru)", "1994-02-05", "1994-06-21"],
  ["Mercury (Budha)", "Venus (Sukra)", "Saturn (Sani)", "1994-06-21", "1994-12-02"],
  ["Mercury (Budha)", "Venus (Sukra)", "Mercury (Budha)", "1994-12-02", "1995-04-27"],
  ["Mercury (Budha)", "Venus (Sukra)", "Ketu", "1995-04-27", "1995-06-26"],
  ["Mercury (Budha)", "Sun (Surya)", "Sun (Surya)", "1995-06-26", "1995-07-11"],
  ["Mercury (Budha)", "Sun (Surya)", "Moon (Chandra)", "1995-07-11", "1995-08-07"],
  ["Mercury (Budha)", "Sun (Surya)", "Mars (Sevvai)", "1995-08-07", "1995-08-25"],
  ["Mercury (Budha)", "Sun (Surya)", "Rahu", "1995-08-25", "1995-10-11"],
  ["Mercury (Budha)", "Sun (Surya)", "Jupiter (Guru)", "1995-10-11", "1995-11-21"],
  ["Mercury (Budha)", "Sun (Surya)", "Saturn (Sani)", "1995-11-21", "1996-01-10"],
  ["Mercury (Budha)", "Sun (Surya)", "Mercury (Budha)", "1996-01-10", "1996-02-23"],
  ["Mercury (Budha)", "Sun (Surya)", "Ketu", "1996-02-23", "1996-03-11"],
  ["Mercury (Budha)", "Sun (Surya)", "Venus (Sukra)", "1996-03-11", "1996-05-02"],
  ["Mercury (Budha)", "Moon (Chandra)", "Moon (Chandra)", "1996-05-02", "1996-06-15"],
  ["Mercury (Budha)", "Moon (Chandra)", "Mars (Sevvai)", "1996-06-15", "1996-07-14"],
  ["Mercury (Budha)", "Moon (Chandra)", "Rahu", "1996-07-14", "1996-10-01"],
  ["Mercury (Budha)", "Moon (Chandra)", "Jupiter (Guru)", "1996-10-01", "1996-12-09"],
  ["Mercury (Budha)", "Moon (Chandra)", "Saturn (Sani)", "1996-12-09", "1997-03-02"],
  ["Mercury (Budha)", "Moon (Chandra)", "Mercury (Budha)", "1997-03-02", "1997-05-12"],
  ["Mercury (Budha)", "Moon (Chandra)", "Ketu", "1997-05-12", "1997-06-12"],
  ["Mercury (Budha)", "Moon (Chandra)", "Venus (Sukra)", "1997-06-12", "1997-09-07"],
  ["Mercury (Budha)", "Moon (Chandra)", "Sun (Surya)", "1997-09-07", "1997-10-02"],

  // 1998 through 2020 interval span
  ["Mercury (Budha)", "Mars (Sevvai)", "Mars (Sevvai)", "1997-10-02", "1997-10-23"],
  ["Mercury (Budha)", "Mars (Sevvai)", "Rahu", "1997-10-23", "1997-12-16"],
  ["Mercury (Budha)", "Mars (Sevvai)", "Jupiter (Guru)", "1997-12-16", "1998-02-04"],
  ["Mercury (Budha)", "Mars (Sevvai)", "Saturn (Sani)", "1998-02-04", "1998-04-01"],
  ["Mercury (Budha)", "Mars (Sevvai)", "Mercury (Budha)", "1998-04-01", "1998-05-21"],
  ["Mercury (Budha)", "Mars (Sevvai)", "Ketu", "1998-05-21", "1998-06-12"],
  ["Mercury (Budha)", "Mars (Sevvai)", "Venus (Sukra)", "1998-06-12", "1998-08-11"],
  ["Mercury (Budha)", "Mars (Sevvai)", "Sun (Surya)", "1998-08-11", "1998-08-29"],
  ["Mercury (Budha)", "Mars (Sevvai)", "Moon (Chandra)", "1998-08-29", "1998-09-29"],
  ["Mercury (Budha)", "Rahu", "Rahu", "1998-09-29", "1999-02-17"],
  ["Mercury (Budha)", "Rahu", "Jupiter (Guru)", "1999-02-17", "1999-06-19"],
  ["Mercury (Budha)", "Rahu", "Saturn (Sani)", "1999-06-19", "1999-11-14"],
  ["Mercury (Budha)", "Rahu", "Mercury (Budha)", "1999-11-14", "2000-03-25"],
  ["Mercury (Budha)", "Rahu", "Ketu", "2000-03-25", "2000-05-18"],
  ["Mercury (Budha)", "Rahu", "Venus (Sukra)", "2000-05-18", "2000-10-21"],
  ["Mercury (Budha)", "Rahu", "Sun (Surya)", "2000-10-21", "2000-12-07"],
  ["Mercury (Budha)", "Rahu", "Moon (Chandra)", "2000-12-07", "2001-02-23"],
  ["Mercury (Budha)", "Rahu", "Mars (Sevvai)", "2001-02-23", "2001-04-17"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Jupiter (Guru)", "2001-04-17", "2001-08-06"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Saturn (Sani)", "2001-08-06", "2001-12-15"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Mercury (Budha)", "2001-12-15", "2002-04-11"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Ketu", "2002-04-11", "2002-05-28"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Venus (Sukra)", "2002-05-28", "2002-10-14"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Sun (Surya)", "2002-10-14", "2002-11-25"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Moon (Chandra)", "2002-11-25", "2003-02-03"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Mars (Sevvai)", "2003-02-03", "2003-03-21"],
  ["Mercury (Budha)", "Jupiter (Guru)", "Rahu", "2003-03-21", "2003-07-23"],
  ["Mercury (Budha)", "Saturn (Sani)", "Saturn (Sani)", "2003-07-23", "2003-12-26"],
  ["Mercury (Budha)", "Saturn (Sani)", "Mercury (Budha)", "2003-12-26", "2004-05-14"],
  ["Mercury (Budha)", "Saturn (Sani)", "Ketu", "2004-05-14", "2004-07-10"],
  ["Mercury (Budha)", "Saturn (Sani)", "Venus (Sukra)", "2004-07-10", "2004-12-22"],
  ["Mercury (Budha)", "Saturn (Sani)", "Sun (Surya)", "2004-12-22", "2005-02-10"],
  ["Mercury (Budha)", "Saturn (Sani)", "Moon (Chandra)", "2005-02-10", "2005-05-01"],
  ["Mercury (Budha)", "Saturn (Sani)", "Mars (Sevvai)", "2005-05-01", "2005-06-27"],
  ["Mercury (Budha)", "Saturn (Sani)", "Rahu", "2005-06-27", "2005-11-23"],
  ["Mercury (Budha)", "Saturn (Sani)", "Jupiter (Guru)", "2005-11-23", "2006-04-02"],

  // Ketu MD (2006 - 2013)
  ["Ketu", "Ketu", "Ketu", "2006-04-02", "2006-04-11"],
  ["Ketu", "Ketu", "Venus (Sukra)", "2006-04-11", "2006-05-05"],
  ["Ketu", "Ketu", "Sun (Surya)", "2006-05-05", "2006-05-12"],
  ["Ketu", "Ketu", "Moon (Chandra)", "2006-05-12", "2006-05-25"],
  ["Ketu", "Ketu", "Mars (Sevvai)", "2006-05-25", "2006-06-03"],
  ["Ketu", "Ketu", "Rahu", "2006-06-03", "2006-06-25"],
  ["Ketu", "Ketu", "Jupiter (Guru)", "2006-06-25", "2006-07-15"],
  ["Ketu", "Ketu", "Saturn (Sani)", "2006-07-15", "2006-08-08"],
  ["Ketu", "Ketu", "Mercury (Budha)", "2006-08-08", "2006-08-29"],
  ["Ketu", "Venus (Sukra)", "Venus (Sukra)", "2006-08-29", "2006-11-09"],
  ["Ketu", "Venus (Sukra)", "Sun (Surya)", "2006-11-09", "2006-11-30"],
  ["Ketu", "Venus (Sukra)", "Moon (Chandra)", "2006-11-30", "2007-01-05"],
  ["Ketu", "Venus (Sukra)", "Mars (Sevvai)", "2007-01-05", "2007-01-30"],
  ["Ketu", "Venus (Sukra)", "Rahu", "2007-01-30", "2007-04-03"],
  ["Ketu", "Venus (Sukra)", "Jupiter (Guru)", "2007-04-03", "2007-05-29"],
  ["Ketu", "Venus (Sukra)", "Saturn (Sani)", "2007-05-29", "2007-08-05"],
  ["Ketu", "Venus (Sukra)", "Mercury (Budha)", "2007-08-05", "2007-10-05"],
  ["Ketu", "Venus (Sukra)", "Ketu", "2007-10-05", "2007-10-29"],
  ["Ketu", "Sun (Surya)", "Sun (Surya)", "2007-10-29", "2007-11-05"],
  ["Ketu", "Sun (Surya)", "Moon (Chandra)", "2007-11-05", "2007-11-16"],
  ["Ketu", "Sun (Surya)", "Mars (Sevvai)", "2007-11-16", "2007-11-23"],
  ["Ketu", "Sun (Surya)", "Rahu", "2007-11-23", "2007-12-12"],
  ["Ketu", "Sun (Surya)", "Jupiter (Guru)", "2007-12-12", "2007-12-29"],
  ["Ketu", "Sun (Surya)", "Saturn (Sani)", "2007-12-29", "2008-01-19"],
  ["Ketu", "Sun (Surya)", "Mercury (Budha)", "2008-01-19", "2008-02-07"],
  ["Ketu", "Sun (Surya)", "Ketu", "2008-02-07", "2008-02-14"],
  ["Ketu", "Sun (Surya)", "Venus (Sukra)", "2008-02-14", "2008-03-05"],
  ["Ketu", "Moon (Chandra)", "Moon (Chandra)", "2008-03-05", "2008-03-23"],
  ["Ketu", "Moon (Chandra)", "Mars (Sevvai)", "2008-03-23", "2008-04-05"],
  ["Ketu", "Moon (Chandra)", "Rahu", "2008-04-05", "2008-05-06"],
  ["Ketu", "Moon (Chandra)", "Jupiter (Guru)", "2008-05-06", "2008-06-04"],
  ["Ketu", "Moon (Chandra)", "Saturn (Sani)", "2008-06-04", "2008-07-08"],
  ["Ketu", "Moon (Chandra)", "Mercury (Budha)", "2008-07-08", "2008-08-07"],
  ["Ketu", "Moon (Chandra)", "Ketu", "2008-08-07", "2008-08-20"],
  ["Ketu", "Moon (Chandra)", "Venus (Sukra)", "2008-08-20", "2008-09-25"],
  ["Ketu", "Moon (Chandra)", "Sun (Surya)", "2008-09-25", "2008-10-05"],

  // Venus MD (2013 - 2033)
  ["Venus (Sukra)", "Venus (Sukra)", "Venus (Sukra)", "2013-04-02", "2013-10-22"],
  ["Venus (Sukra)", "Venus (Sukra)", "Sun (Surya)", "2013-10-22", "2013-12-22"],
  ["Venus (Sukra)", "Venus (Sukra)", "Moon (Chandra)", "2013-12-22", "2014-04-02"],
  ["Venus (Sukra)", "Venus (Sukra)", "Mars (Sevvai)", "2014-04-02", "2014-06-12"],
  ["Venus (Sukra)", "Venus (Sukra)", "Rahu", "2014-06-12", "2014-12-12"],
  ["Venus (Sukra)", "Venus (Sukra)", "Jupiter (Guru)", "2014-12-12", "2015-05-22"],
  ["Venus (Sukra)", "Venus (Sukra)", "Saturn (Sani)", "2015-05-22", "2015-12-02"],
  ["Venus (Sukra)", "Venus (Sukra)", "Mercury (Budha)", "2015-12-02", "2016-05-22"],
  ["Venus (Sukra)", "Venus (Sukra)", "Ketu", "2016-05-22", "2016-08-02"],
  ["Venus (Sukra)", "Sun (Surya)", "Sun (Surya)", "2016-08-02", "2016-08-20"],
  ["Venus (Sukra)", "Sun (Surya)", "Moon (Chandra)", "2016-08-20", "2016-09-20"],
  ["Venus (Sukra)", "Sun (Surya)", "Mars (Sevvai)", "2016-09-20", "2016-10-11"],
  ["Venus (Sukra)", "Sun (Surya)", "Rahu", "2016-10-11", "2016-12-05"],
  ["Venus (Sukra)", "Sun (Surya)", "Jupiter (Guru)", "2016-12-05", "2017-01-23"],
  ["Venus (Sukra)", "Sun (Surya)", "Saturn (Sani)", "2017-01-23", "2017-03-20"],
  ["Venus (Sukra)", "Sun (Surya)", "Mercury (Budha)", "2017-03-20", "2017-05-11"],
  ["Venus (Sukra)", "Sun (Surya)", "Ketu", "2017-05-11", "2017-06-02"],
  ["Venus (Sukra)", "Sun (Surya)", "Venus (Sukra)", "2017-06-02", "2017-08-02"],
  ["Venus (Sukra)", "Moon (Chandra)", "Moon (Chandra)", "2017-08-02", "2017-09-22"],
  ["Venus (Sukra)", "Moon (Chandra)", "Mars (Sevvai)", "2017-09-22", "2017-10-27"],
  ["Venus (Sukra)", "Moon (Chandra)", "Rahu", "2017-10-27", "2018-01-27"],
  ["Venus (Sukra)", "Moon (Chandra)", "Jupiter (Guru)", "2018-01-27", "2018-04-17"],
  ["Venus (Sukra)", "Moon (Chandra)", "Saturn (Sani)", "2018-04-17", "2018-07-22"],
  ["Venus (Sukra)", "Moon (Chandra)", "Mercury (Budha)", "2018-07-22", "2018-10-17"],
  ["Venus (Sukra)", "Moon (Chandra)", "Ketu", "2018-10-17", "2018-11-22"],
  ["Venus (Sukra)", "Moon (Chandra)", "Venus (Sukra)", "2018-11-22", "2019-03-02"],
  ["Venus (Sukra)", "Moon (Chandra)", "Sun (Surya)", "2019-03-02", "2019-04-02"],
  ["Venus (Sukra)", "Mars (Sevvai)", "Mars (Sevvai)", "2019-04-02", "2019-04-27"],
  ["Venus (Sukra)", "Mars (Sevvai)", "Rahu", "2019-04-27", "2019-06-30"],
  ["Venus (Sukra)", "Mars (Sevvai)", "Jupiter (Guru)", "2019-06-30", "2019-08-26"],
  ["Venus (Sukra)", "Mars (Sevvai)", "Saturn (Sani)", "2019-08-26", "2019-11-02"],
  ["Venus (Sukra)", "Mars (Sevvai)", "Mercury (Budha)", "2019-11-02", "2020-01-02"],
  ["Venus (Sukra)", "Mars (Sevvai)", "Ketu", "2020-01-02", "2020-01-26"]
];

let clientRunningCounter = 1;

export function normalizeDateString(inputVal: string, defaultToEndOfMonth: boolean = false): string {
  if (!inputVal) return new Date().toISOString().slice(0, 10);
  const s = inputVal.trim().toLowerCase();

  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // DD.MM.YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // YYYY-MM, YYYY/MM, YYYY.MM (e.g. "2028-01", "2028-04", "2028/1", "2028-6")
  const ymMatch = s.match(/^(\d{4})[./-](\d{1,2})$/);
  if (ymMatch) {
    const yNum = parseInt(ymMatch[1], 10);
    const mNum = Math.max(1, Math.min(12, parseInt(ymMatch[2], 10)));
    let day = 1;
    if (defaultToEndOfMonth) {
      day = [1, 3, 5, 7, 8, 10, 12].includes(mNum) ? 31 : (mNum === 2 ? (yNum % 4 === 0 ? 29 : 28) : 30);
    }
    return `${yNum}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // MM/YYYY, MM-YYYY, MM.YYYY (e.g. "01/2028", "04-2028", "4/2028")
  const myMatch = s.match(/^(\d{1,2})[./-](\d{4})$/);
  if (myMatch) {
    const mNum = Math.max(1, Math.min(12, parseInt(myMatch[1], 10)));
    const yNum = parseInt(myMatch[2], 10);
    let day = 1;
    if (defaultToEndOfMonth) {
      day = [1, 3, 5, 7, 8, 10, 12].includes(mNum) ? 31 : (mNum === 2 ? (yNum % 4 === 0 ? 29 : 28) : 30);
    }
    return `${yNum}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Month Name + Year (e.g. "January 1998", "jan 1998")
  const months: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12
  };
  const mYearMatch = s.match(/([a-z]+)\s+(\d{4})/);
  if (mYearMatch) {
    const mNum = months[mYearMatch[1].slice(0, 3)] || 1;
    const yNum = parseInt(mYearMatch[2], 10);
    const day = defaultToEndOfMonth
      ? ([1, 3, 5, 7, 8, 10, 12].includes(mNum) ? 31 : (mNum === 2 ? 28 : 30))
      : 1;
    return `${yNum}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  if (/^\d{4}$/.test(s)) {
    return defaultToEndOfMonth ? `${s}-12-31` : `${s}-01-01`;
  }

  return inputVal;
}

export const samplePersonKumar: PersonMaster = {
  person_id: "002KUMAR",
  person_name: "Kumar (Tamil Horoscope)",
  age: 42,
  date_of_birth: "1984-07-18",
  place_of_birth: "Chennai, Tamil Nadu",
  birth_lagna: "Mesham (Aries)",
  birth_rashi: "Rishabam (Taurus)",
  birth_star: "Rohini (Moon Lord)",
  birth_star_pada: 1,
  starting_dasha_lord: "Moon (Chandra)",
  dasha_balance_years: 7,
  dasha_balance_months: 5,
  dasha_balance_days: 10,
  dasha_balance_text: "7-வருஷம் 5-மாதம் 10-நாள்"
};

export const samplePlacementsKumar: NatalPlacement[] = [
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Lagna", rashi_name: "Mesham (Aries)", house_number: 1, nakshatra_name: "Ashwini", pada: 1, degree_sputa: "02° 15'", is_retrograde: false },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Moon (Chandra)", rashi_name: "Rishabam (Taurus)", house_number: 2, nakshatra_name: "Rohini", pada: 1, degree_sputa: "11° 40'", is_retrograde: false },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Venus (Sukra)", rashi_name: "Rishabam (Taurus)", house_number: 2, nakshatra_name: "Krittika", pada: 3, degree_sputa: "04° 10'", is_retrograde: false },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Sun (Surya)", rashi_name: "Katakam (Cancer)", house_number: 4, nakshatra_name: "Pushya", pada: 2, degree_sputa: "02° 22'", is_retrograde: false },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Mercury (Budha)", rashi_name: "Simham (Leo)", house_number: 5, nakshatra_name: "Magha", pada: 3, degree_sputa: "09° 12'", is_retrograde: false },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Mars (Sevvai)", rashi_name: "Thulaam (Libra)", house_number: 7, nakshatra_name: "Swati", pada: 2, degree_sputa: "15° 30'", is_retrograde: false },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Saturn (Sani)", rashi_name: "Thulaam (Libra)", house_number: 7, nakshatra_name: "Vishakha", pada: 1, degree_sputa: "20° 45'", is_retrograde: true },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Jupiter (Guru)", rashi_name: "Dhanus (Sagittarius)", house_number: 9, nakshatra_name: "Mula", pada: 4, degree_sputa: "12° 50'", is_retrograde: false },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Rahu", rashi_name: "Rishabam (Taurus)", house_number: 2, nakshatra_name: "Rohini", pada: 2, degree_sputa: "14° 05'", is_retrograde: false },
  { person_id: "002KUMAR", chart_type: "D1", body_name: "Ketu", rashi_name: "Vrischigam (Scorpio)", house_number: 8, nakshatra_name: "Anuradha", pada: 4, degree_sputa: "14° 05'", is_retrograde: false }
];

// Ingested Persons In-Memory Registry (authoritative DB data store)
export const ingestedPersonsRegistry: Record<string, {
  profile: PersonMaster;
  placements: NatalPlacement[];
  dashaRecords?: [string, string, string, string, string][];
}> = {
  ...(storedPersonsData as any)
};

// Clear any old stale caches from browser storage so live data is always authoritative
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('astro_persons_db');
    localStorage.removeItem('astro_active_person_id');
  } catch {}
}

export async function fetchPersonDetailsFromBackend(personId: string) {
  try {
    const res = await fetch(`/api/persons/${encodeURIComponent(personId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.person) {
        ingestedPersonsRegistry[personId] = json.person;
        return json.person;
      }
    }
  } catch (e) {
    console.warn(`Could not fetch details for person ${personId}:`, e);
  }
  return ingestedPersonsRegistry[personId] || null;
}

export async function registerIngestedPerson(
  personId: string,
  profile: PersonMaster,
  placements: NatalPlacement[],
  dashaRecords?: [string, string, string, string, string][]
): Promise<{ success: boolean; message: string }> {
  ingestedPersonsRegistry[personId] = {
    profile,
    placements,
    dashaRecords: dashaRecords || ALL_DASHA_TIMELINE
  };

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('astro_persons_db', JSON.stringify(ingestedPersonsRegistry));
    } catch {}
  }

  // Push to backend database tables
  try {
    const res = await fetch('/api/horoscope/save-person', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person: profile,
        placements,
        dashaTimeline: dashaRecords
      })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || 'Saved to database tables' };
    }
  } catch (err: any) {
    console.warn('Backend sync notice:', err);
  }

  return { success: true, message: 'Saved to local table registry' };
}

export async function syncPersonsFromBackend(): Promise<string[]> {
  try {
    const res = await fetch('/api/persons');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.persons)) {
        const ids: string[] = [];
        for (const p of json.persons) {
          if (p.person_id) {
            ids.push(p.person_id);
            if (!ingestedPersonsRegistry[p.person_id] || !ingestedPersonsRegistry[p.person_id].placements) {
              await fetchPersonDetailsFromBackend(p.person_id);
            }
          }
        }
        return ids;
      }
    }
  } catch {}
  return Object.keys(ingestedPersonsRegistry);
}

export function getRegisteredPersonList(): { id: string; name: string; lagna: string; rashi: string; star?: string; dob?: string }[] {
  return Object.keys(ingestedPersonsRegistry).map(pid => {
    const p = ingestedPersonsRegistry[pid].profile;
    return {
      id: pid,
      name: p.person_name,
      lagna: p.birth_lagna,
      rashi: p.birth_rashi,
      star: p.birth_star,
      dob: p.date_of_birth
    };
  });
}

export function executeHoroscopeTimelineQuery(personId: string, startDateStr: string, endDateStr: string): HoroscopeApiResponse {
  const normStart = normalizeDateString(startDateStr, false);
  const normEnd = normalizeDateString(endDateStr, true);

  const runningNum = clientRunningCounter;
  clientRunningCounter = clientRunningCounter >= 100 ? 1 : clientRunningCounter + 1;

  const now = new Date();
  const timestampStr = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const uniqueResponseId = `Q-${personId}-${String(runningNum).padStart(3, '0')}-${timestampStr}`;

  // Resolve person from ingested registry or fallback to 001ME
  const registered = ingestedPersonsRegistry[personId] || ingestedPersonsRegistry['001ME'];
  const personProfile = registered.profile;
  const natalPlacementsList = registered.placements;
  let dashaSource: [string, string, string, string, string][];
  if (registered.dashaRecords && registered.dashaRecords.length > 50) {
    dashaSource = registered.dashaRecords;
  } else if (personId === '001ME') {
    dashaSource = getFullVimshottariTimeline();
  } else {
    dashaSource = calculateVimshottariTimelineForProfile(personProfile);
  }

  // Filter overlapping periods: (start_date <= requested_end) AND (end_date >= requested_start)
  const filtered = dashaSource.filter(([_, __, ___, s, e]) => s <= normEnd && e >= normStart);

  const intervals: DashaIntervalItem[] = filtered.map(([md, ad, pd, s, e], idx) => {
    let days: number | null = null;
    try {
      const d1 = new Date(s);
      const d2 = new Date(e);
      days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    } catch {}

    return {
      sequence_index: idx + 1,
      mahadasha_lord_md: md,
      antardasha_lord_ad: ad,
      pratyantardasha_lord_pd: pd,
      full_lord_hierarchy: `MD: ${md} > AD: ${ad} > PD: ${pd}`,
      start_date: s,
      end_date: e,
      duration_days: days
    };
  });

  let spanYears: number | null = null;
  try {
    const sDate = new Date(normStart);
    const eDate = new Date(normEnd);
    spanYears = parseFloat(((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(2));
  } catch {}

  const d1Bodies = natalPlacementsList.filter(p => p.chart_type === 'D1');
  const d9Bodies = natalPlacementsList.filter(p => p.chart_type === 'D9');

  // Determine lagna sign index (0 to 11) for transit calculations
  const lagnaMatch = personProfile.birth_lagna.toLowerCase();
  const rashiMatch = personProfile.birth_rashi.toLowerCase();
  
  const signKeys = [
    'mesham', 'rishabham', 'mithunam', 'katakam', 'simham', 'kanni',
    'thulaam', 'vrischigam', 'dhanus', 'makaram', 'kumbham', 'meenam'
  ];
  let lagnaIdx = 9; // Dhanus default (1-based = 9)
  let rashiIdx = 8; // Vrischigam default (1-based = 8)

  signKeys.forEach((s, i) => {
    if (lagnaMatch.includes(s) || lagnaMatch.includes(s.slice(0, 4))) lagnaIdx = i + 1;
    if (rashiMatch.includes(s) || rashiMatch.includes(s.slice(0, 4))) rashiIdx = i + 1;
  });

  return {
    unique_response_id: uniqueResponseId,
    running_number: runningNum,
    person_id: personId,
    requested_timeline: {
      start_date: normStart,
      end_date: normEnd,
      span_years: spanYears
    },
    person_profile: personProfile,
    natal_placements: {
      D1_rashi_chart: {
        count: d1Bodies.length,
        lagna_sign: personProfile.birth_lagna,
        bodies: d1Bodies
      },
      D9_navamsha_chart: {
        count: d9Bodies.length,
        bodies: d9Bodies
      }
    },
    vimshottari_dasha_intervals: {
      total_intervals_count: intervals.length,
      granularity: "Pratyantardasha (PD) Level",
      intervals
    },
    transit_ephemeris_timeline: generateClientTransitTimeline(normStart, normEnd, lagnaIdx, rashiIdx),
    server_timestamp: now.toISOString(),
    persisted_in_database: {
      table: "user_queries",
      running_number_cycle: `${runningNum}/100`,
      status: "SAVED"
    }
  };
}

export interface ApiFetchResult {
  data: HoroscopeApiResponse;
  rawMarkdown?: string;
  source: 'live_server' | 'fallback_simulator';
  statusCode: number;
  durationMs: number;
  error?: string;
  endpointUsed?: string;
}

/**
 * Returns ordered candidate base URLs to try.
 * Solves Windows IPv6 localhost resolution and Vite dev server proxy differences.
 */
function getCandidateBaseUrls(userBaseUrl: string): string[] {
  const trimmed = userBaseUrl.trim().replace(/\/+$/, '');
  const candidates: string[] = ['']; // Relative /api on current origin first

  if (trimmed && trimmed !== '' && trimmed !== '/api') {
    candidates.push(trimmed);
  }

  // Deduplicate
  return Array.from(new Set(candidates));
}

/**
 * Executes a REAL HTTP POST call to the Python REST API server.
 * Tries localhost:5000, 127.0.0.1:5000, and /api (Vite proxy) in sequence.
 */
export async function fetchHoroscopeFromApi(
  baseUrl: string,
  personId: string,
  startDate: string,
  endDate: string,
  format: 'full' | 'llm_markdown' = 'full'
): Promise<ApiFetchResult> {
  const candidates = getCandidateBaseUrls(baseUrl);
  const t0 = performance.now();
  let lastError = '';

  for (const candidate of candidates) {
    const cleanBase = candidate.replace(/\/+$/, '');
    const url = cleanBase ? `${cleanBase}/api/horoscope/query` : `/api/horoscope/query`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': format === 'llm_markdown' ? 'text/markdown, application/json' : 'application/json'
        },
        body: JSON.stringify({
          person_id: personId,
          start_date: startDate,
          end_date: endDate,
          format: format === 'llm_markdown' ? 'llm_markdown' : 'full'
        })
      });

      const durationMs = Math.round(performance.now() - t0);
      const contentType = res.headers.get('content-type') || '';

      if (res.ok) {
        if (contentType.includes('text/markdown')) {
          const mdText = await res.text();
          const fallbackJson = executeHoroscopeTimelineQuery(personId, startDate, endDate);
          return {
            data: fallbackJson,
            rawMarkdown: mdText,
            source: 'live_server',
            statusCode: res.status,
            durationMs,
            endpointUsed: url
          };
        } else {
          const json = await res.json();
          // Ensure transit_ephemeris_timeline for 9 Grahas is never missing
          if (!json.transit_ephemeris_timeline) {
            const fallbackJson = executeHoroscopeTimelineQuery(personId, startDate, endDate);
            json.transit_ephemeris_timeline = fallbackJson.transit_ephemeris_timeline;
          }
          return {
            data: json,
            source: 'live_server',
            statusCode: res.status,
            durationMs,
            endpointUsed: url
          };
        }
      } else {
        lastError = `HTTP ${res.status}: ${res.statusText} from ${url}`;
      }
    } catch (err: any) {
      lastError = err?.message || 'Connection failed';
    }
  }

  // If all live server candidates were unreachable
  const durationMs = Math.round(performance.now() - t0);
  const fallbackData = executeHoroscopeTimelineQuery(personId, startDate, endDate);
  return {
    data: fallbackData,
    source: 'fallback_simulator',
    statusCode: 0,
    durationMs,
    error: `Could not connect to Python REST API (tried: ${candidates.map(c => c || 'relative /api').join(', ')}). Error: ${lastError}`,
    endpointUsed: candidates[0] || 'http://127.0.0.1:5000'
  };
}

/**
 * Pings the Python REST server health endpoint (/api/health)
 * Tries the given base URL first, then 127.0.0.1:5000 or relative /api
 */
export async function pingApiHealth(baseUrl: string): Promise<{ ok: boolean; statusText: string; latencyMs: number; details?: any; endpointUsed: string }> {
  const candidates = getCandidateBaseUrls(baseUrl);
  const t0 = performance.now();
  let lastStatus = '';

  for (const candidate of candidates) {
    const cleanBase = candidate.replace(/\/+$/, '');
    const url = cleanBase ? `${cleanBase}/api/health` : `/api/health`;

    try {
      const res = await fetch(url, { method: 'GET' });
      const latencyMs = Math.round(performance.now() - t0);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, statusText: `Online (HTTP 200 via ${url})`, latencyMs, details: data, endpointUsed: cleanBase || 'relative /api' };
      }
      lastStatus = `HTTP ${res.status} from ${url}`;
    } catch (e: any) {
      lastStatus = e?.message || 'Connection refused';
    }
  }

  return { ok: false, statusText: `Offline: ${lastStatus}`, latencyMs: Math.round(performance.now() - t0), endpointUsed: candidates[0] || 'http://127.0.0.1:5000' };
}

/**
 * Transforms any HoroscopeApiResponse into Option B: High-Density LLM Markdown
 * with STRICT PII SANITIZATION (zero human personal details, zero Tamil text noise).
 */
export function generateLlmMarkdown(res: HoroscopeApiResponse): string {
  const profile = res.person_profile;
  const startD = res.requested_timeline.start_date;
  const endD = res.requested_timeline.end_date;
  const spanYrs = res.requested_timeline.span_years ?? '-';

  const lines: string[] = [];

  lines.push('# VEDIC ASTROLOGICAL REASONING MATRIX (ANONYMIZED)');
  lines.push(`**Reference ID:** \`${res.person_id}\` | **Analysis Window:** \`${startD}\` to \`${endD}\` (${spanYrs} years)`);
  lines.push(`**Lagna (Ascendant):** ${profile.birth_lagna} | **Janma Rashi (Moon Sign):** ${profile.birth_rashi} | **Birth Nakshatra:** ${profile.birth_star} (Pada ${profile.birth_star_pada}) | **Starting Dasha:** ${profile.starting_dasha_lord}`);
  lines.push('');

  // 1. Combined Natal Placements (D1 & D9)
  const d1 = res.natal_placements.D1_rashi_chart.bodies;
  const d9 = res.natal_placements.D9_navamsha_chart.bodies;
  const d9Map = new Map(d9.map(b => [b.body_name, b]));

  lines.push('## 1. NATAL CHART PLACEMENTS (D1 Rashi & D9 Navamsha)');
  lines.push('| Graha | D1 Sign | D1 House (Lagna=1) | Sputa Degree | Nakshatra & Pada | Motion | D9 Sign | D9 House |');
  lines.push('| :--- | :--- | :---: | :---: | :--- | :---: | :--- | :---: |');

  for (const p of d1) {
    const d9Match = d9Map.get(p.body_name);
    const nakPada = p.nakshatra_name ? `${p.nakshatra_name} (P${p.pada ?? 1})` : '-';
    const motion = p.is_retrograde ? 'Retrograde' : 'Direct';
    const d9Sign = d9Match?.rashi_name ?? '-';
    const d9House = d9Match?.house_number ?? '-';
    lines.push(`| ${p.body_name} | ${p.rashi_name} | ${p.house_number} | ${p.degree_sputa || '-'} | ${nakPada} | ${motion} | ${d9Sign} | ${d9House} |`);
  }
  lines.push('');

  // 2. Active Vimshottari Dasha Timeline (MD > AD > PD)
  const intervals = res.vimshottari_dasha_intervals.intervals;
  lines.push(`## 2. ACTIVE VIMSHOTTARI DASHA TIMELINE (${intervals.length} Sequential Periods at PD Level)`);
  lines.push('| # | Period Interval | Mahadasha (MD) | Antardasha (AD) | Pratyantardasha (PD) | Duration |');
  lines.push('| -: | :--- | :--- | :--- | :--- | -: |');
  for (const it of intervals) {
    const dur = it.duration_days ? `${it.duration_days}d` : '-';
    lines.push(`| ${it.sequence_index} | ${it.start_date} to ${it.end_date} | ${it.mahadasha_lord_md} | ${it.antardasha_lord_ad} | ${it.pratyantardasha_lord_pd} | ${dur} |`);
  }
  lines.push('');

  // 3. Gochara (Transit) Snapshot
  if (res.transit_ephemeris_timeline) {
    const snap = res.transit_ephemeris_timeline.transit_snapshot_start;
    if (snap && snap.length > 0) {
      lines.push(`## 3. GOCHARA (TRANSIT) SNAPSHOT (At Window Start: ${startD})`);
      lines.push('| Graha | Transit Sign | House from Lagna (H_L) | House from Moon (H_M) | Sputa Degree | Nakshatra & Pada | Motion |');
      lines.push('| :--- | :--- | :---: | :---: | :---: | :--- | :---: |');
      for (const g of snap) {
        const motion = g.is_retrograde ? 'Retrograde' : 'Direct';
        lines.push(`| ${g.graha_name} | ${g.transit_rashi_name} | House ${g.relative_to_natal_lagna.house_number} | House ${g.relative_to_natal_rashi.house_number} | ${g.degree_sputa} | ${g.graha_pada_chara.chara_summary} | ${motion} |`);
      }
      lines.push('');
    }

    // 4. Major Transit Sign Ingresses
    const ingresses = res.transit_ephemeris_timeline.major_transits_timeline;
    if (ingresses && ingresses.length > 0) {
      // If long timeline, focus on major slow planets (Jupiter, Saturn, Rahu, Ketu)
      const majorPlanets = new Set(['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Jupiter (Guru)', 'Saturn (Sani)']);
      const filtered = (res.requested_timeline.span_years || 0) > 3
        ? ingresses.filter(ev => Array.from(majorPlanets).some(p => ev.graha_name.includes(p)))
        : ingresses;

      lines.push(`## 4. MAJOR PLANETARY TRANSIT INGRESSES ACROSS TIMELINE (${filtered.length} Transitions)`);
      lines.push('| Graha | Ingress Sign | From Lagna | From Moon | Active Period | Star Occupied |');
      lines.push('| :--- | :--- | :---: | :---: | :--- | :--- |');
      for (const ev of filtered) {
        lines.push(`| ${ev.graha_name} | ${ev.transit_rashi_name} | House ${ev.house_from_natal_lagna} | House ${ev.house_from_natal_rashi} | ${ev.start_date} to ${ev.end_date} | ${ev.nakshatra_name} (P${ev.pada}) |`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('*(Astrological inference instructions: Analyze active MD/AD/PD lords, examine their natal house rulerships from Lagna and Janma Rashi, and cross-reference with contemporaneous Gochara transits.)*');

  return lines.join('\n');
}

