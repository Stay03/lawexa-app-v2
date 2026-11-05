/**
 * Lawexa Wrapped, Bar Finals edition: the record `GET /api/wrapped/me` returns
 * (Backend's field list v1, 4 November 2026, approved by the techlead in thread
 * f833c285). One record per student, computed once by the night job; the story
 * reads it and never queries live data. A 404 is no record, or the student
 * turned on Hide from Wrapped. Values are raw: the app formats them.
 */

export type WrappedCampus = 'lagos' | 'abuja' | 'enugu' | 'port_harcourt' | 'bayelsa' | 'kano' | 'yola';

export type WrappedCourseKey =
  | 'civil_litigation'
  | 'criminal_litigation'
  | 'corporate_law_practice'
  | 'property_law_practice'
  | 'professional_ethics';

export type WrappedCourseStatus = 'married' | 'best_friends' | 'situationship' | 'its_complicated' | 'talking_stage';

export type WrappedPersonaKey =
  | 'section_quoter'
  | 'overnight_scholar'
  | 'case_law_collector'
  | 'drafting_don'
  | 'last_minute_lord'
  | 'steady_learned_friend';

/** The eight frames, in story order. */
export type WrappedSlideNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface WrappedStudent {
  /** Already cut at 14 characters. */
  first_name: string;
  last_initial: string | null;
  campus: WrappedCampus | null;
  photo_url: string | null;
}

export interface WrappedCourse {
  key: WrappedCourseKey;
  name: string;
  status: WrappedCourseStatus;
  reads: number;
  quiz_answers: number;
}

export interface WrappedOvernight {
  overnights: number;
  /** "03:47", WAT. */
  latest_logoff: string;
  total_hours: number;
  working_days: number;
  ikorodu_vi_trips: number;
}

export interface WrappedBigFive {
  top_statutes: { name: string; opens: number }[];
  /** `section` is "Section 22", or the part's own title when it has no number. */
  top_sections: { statute: string; section: string; highlights: number }[];
  top_case: { title: string; citation: string | null; opens: number } | null;
  judgments_read: number;
  law_report_pages: number;
  most_time_course: WrappedCourseKey | null;
}

export type WrappedGaniFigure = 'gani_fawehinmi' | 'fra_williams' | 'to_elias' | 'lord_denning';

export interface WrappedObsession {
  subject: string;
  reads: number;
  course_key: WrappedCourseKey | null;
  unusual_pair: [string, string] | null;
  gani: { figure: WrappedGaniFigure; subject: string } | null;
}

export interface WrappedNoGree {
  longest_streak: number;
  days_active: number;
  /** Days of the 26 to 30 October revision week, 0 to 5. */
  revision_week_days: number;
  weekend_share_pct: number;
  campus_league: { rank: number; of: number; top_campus: WrappedCampus } | null;
}

export interface WrappedDrafting {
  words_written: number;
  novels: number;
  mocks_answered: number;
  best_mock_pct: number | null;
  quiz_rise: { course_key: WrappedCourseKey; from_pct: number; to_pct: number; from_month: string; to_month: string } | null;
}

export interface WrappedMetric {
  metric: string;
  value: number;
}

export interface WrappedSticker {
  key: string;
  value: number | string;
}

export interface WrappedRecord {
  /** "bar-finals-2026". */
  edition: string;
  /** When the night job built this record, ISO 8601 in WAT. */
  built_at: string;
  /** The frames to show, in order: the server has already applied the skip rules. */
  slides: WrappedSlideNumber[];
  /** "short" is [1, 7, 8]. */
  story: 'full' | 'short';
  student: WrappedStudent;
  report_slip: { courses: WrappedCourse[] };
  overnight: WrappedOvernight | null;
  big_five: WrappedBigFive;
  obsession: WrappedObsession | null;
  no_gree: WrappedNoGree;
  drafting: WrappedDrafting | null;
  /** `reason` is null for the default persona, The Steady Learned Friend. */
  persona: { key: WrappedPersonaKey; reason: WrappedMetric | null };
  percentile: WrappedMetric | null;
  vibe: { id: number; campus: WrappedCampus | null };
  stickers: WrappedSticker[];
  share_code: string;
  /** How many people signed up from this student's shares so far; guests are not counted. */
  share_signups: number;
}
