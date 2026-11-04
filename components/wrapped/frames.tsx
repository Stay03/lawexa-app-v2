import type { ReactNode } from 'react';

import {
  CAMPAIGN_LINE,
  CAMPUS_NAMES,
  COURSE_NAMES,
  GANI_FIGURES,
  PERSONAS,
  PERSONA_ORDER,
  STATUS_LABELS,
  formatClock,
  formatCount,
  formatWords,
  ordinal,
  percentileLine,
  personaReason,
  shareName,
} from '@/lib/wrapped/copy';
import { FRAME_THEMES } from '@/lib/wrapped/theme';
import type { WrappedCourseKey, WrappedRecord, WrappedSlideNumber } from '@/lib/wrapped/types';

/**
 * The eight frames of Lawexa Wrapped, Bar Finals edition, in the order and
 * words agreed in thread f833c285 (4 November 2026): every number is the
 * student's own reading, quizzes and active time, never their questions, and
 * nothing judges how they did. A frame draws only what the record holds; the
 * server has already skipped a frame with nothing to show. The art boxes
 * (`.wr-art`) stand in for Arthur's canvas until it arrives.
 */

/** The share cards' four pattern kinds (Arthur's frames), one per frame in turn. */
const PATTERNS = ['rings', 'checks', 'dots', 'stripes'] as const;

function Frame({ slide, children, label }: { slide: WrappedSlideNumber; children: ReactNode; label: string }) {
  const theme = FRAME_THEMES[slide];
  return (
    <section className="wr-frame" data-ground={theme.ground} aria-label={label} style={{ ['--wr-accent' as string]: `var(--wr-${theme.accent})` }}>
      {/* The system's pattern block, bleeding off the lower right, and its scribble near the foot. */}
      <span aria-hidden className="wr-pattern" data-kind={PATTERNS[slide % PATTERNS.length]} style={{ color: theme.ground === 'ink' ? 'var(--wr-accent)' : 'var(--wr-ink)' }} />
      <svg aria-hidden className="wr-scribble" style={{ bottom: '6cqw' }} viewBox="0 0 1080 130" preserveAspectRatio="none">
        <path d="M0 60 C 180 30, 300 80, 480 60 S 760 30, 1080 55" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.85" />
      </svg>
      {children}
    </section>
  );
}

const accent = { color: 'var(--wr-accent)' } as const;

function courseName(key: WrappedCourseKey | null | undefined, record: WrappedRecord): string | null {
  if (!key) return null;
  return record.report_slip.courses.find((course) => course.key === key)?.name ?? COURSE_NAMES[key] ?? null;
}

/* 01 ── Your Special Lawexa Bar Finals Report */
function ReportSlip({ record }: { record: WrappedRecord }) {
  const { student } = record;
  const campus = student.campus ? `${CAMPUS_NAMES[student.campus]} Campus, ` : '';
  return (
    <Frame slide={1} label="Your Special Lawexa Bar Finals Report">
      <p className="wr-kicker wr-rise">Lawexa · Bar Finals 2026</p>
      <h2 className="wr-title wr-rise">
        Your Special Lawexa Bar Finals Report <span style={accent}>is out.</span>
      </h2>
      <div className="wr-slip wr-rise" style={{ animationDelay: '120ms' }}>
        <p className="wr-small" style={{ color: 'var(--wr-ink)', fontWeight: 700 }}>
          {shareName(student.first_name, student.last_initial)}
        </p>
        <p className="wr-small">{campus}Class of 2026</p>
        <ul style={{ marginTop: '3cqw' }}>
          {record.report_slip.courses.map((course) => (
            <li key={course.key} className="wr-slip-row">
              <span className="wr-body" style={{ fontWeight: 700, lineHeight: 1.15 }}>
                {course.name}
              </span>
              <span className="wr-done" aria-label="Done">
                DONE
              </span>
              <span className="wr-small">{STATUS_LABELS[course.status]}</span>
            </li>
          ))}
        </ul>
      </div>
      <span className="wr-sticker wr-rise" data-tone="gold" style={{ marginTop: '2cqw', animationDelay: '260ms' }}>
        Verdict: Survived
      </span>
    </Frame>
  );
}

/* 02 ── Overnight certified */
function Overnight({ record }: { record: WrappedRecord }) {
  const night = record.overnight;
  if (!night) return null;
  return (
    <Frame slide={2} label="Overnight certified">
      <p className="wr-kicker wr-rise">Overnight certified</p>
      <p className="wr-huge wr-rise" style={accent}>
        {formatCount(night.overnights)}
      </p>
      <p className="wr-big wr-rise">{night.overnights === 1 ? 'overnight.' : 'overnights.'}</p>
      <p className="wr-body wr-rise" style={{ animationDelay: '120ms' }}>
        Latest log-off: <strong className="wr-num">{formatClock(night.latest_logoff)}</strong>.
      </p>
      <p className="wr-body wr-rise" style={{ animationDelay: '200ms' }}>
        <strong className="wr-num">{formatCount(night.total_hours)} hours</strong> on Lawexa. That&rsquo;s{' '}
        <span className="wr-num">{formatCount(night.working_days)}</span> working days, or{' '}
        <span className="wr-num">{formatCount(night.ikorodu_vi_trips)}</span> Ikorodu to VI trips in traffic.
      </p>
      <div className="wr-art" aria-hidden />
    </Frame>
  );
}

/* 03 ── The Big Five */
function BigFive({ record }: { record: WrappedRecord }) {
  const big = record.big_five;
  const mostTime = courseName(big.most_time_course, record);
  return (
    <Frame slide={3} label="The Big Five">
      <p className="wr-kicker wr-rise">The Big Five</p>
      {big.top_statutes.length > 0 ? (
        <div className="wr-rise">
          <h2 className="wr-big" style={{ marginBottom: '2.4cqw' }}>
            Your top statutes
          </h2>
          <ol className="wr-list">
            {big.top_statutes.slice(0, 5).map((statute) => (
              <li key={statute.name}>
                <span>{statute.name}</span>
                <span className="wr-num" style={{ opacity: 0.7 }}>
                  {formatCount(statute.opens)}×
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {big.top_sections.length > 0 ? (
        <div className="wr-rise" style={{ animationDelay: '120ms' }}>
          <h3 className="wr-body" style={{ fontWeight: 700, marginBottom: '1.6cqw' }}>
            Sections you highlighted most
          </h3>
          <ol className="wr-list">
            {big.top_sections.slice(0, 5).map((section) => (
              <li key={`${section.statute}:${section.section}`}>
                <span>
                  {section.section}, {section.statute}
                </span>
                <span className="wr-num" style={{ opacity: 0.7 }}>
                  {formatCount(section.highlights)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {big.top_case ? (
        <p className="wr-body wr-rise" style={{ animationDelay: '200ms' }}>
          You opened <strong>{big.top_case.title}</strong> <span className="wr-num">{formatCount(big.top_case.opens)}</span> times. At this
          point you should be on the legal team.
        </p>
      ) : null}
      {big.judgments_read > 0 ? (
        <p className="wr-body wr-rise" style={{ animationDelay: '260ms' }}>
          <strong className="wr-num" style={accent}>
            {formatCount(big.judgments_read)}
          </strong>{' '}
          judgments, about <span className="wr-num">{formatCount(big.law_report_pages)}</span> pages of law reports.
        </p>
      ) : null}
      {mostTime ? (
        <span className="wr-sticker wr-rise" data-tone="ink" style={{ marginTop: 'auto', animationDelay: '320ms' }}>
          Most Time Spent: {mostTime}
        </span>
      ) : null}
    </Frame>
  );
}

/* 04 ── You and {subject} had a thing */
function Obsession({ record }: { record: WrappedRecord }) {
  const thing = record.obsession;
  if (!thing) return null;
  return (
    <Frame slide={4} label={`You and ${thing.subject} had a thing`}>
      <p className="wr-kicker wr-rise">Your legal obsession</p>
      <h2 className="wr-title wr-rise">
        You and <span style={accent}>{thing.subject}</span> had a thing.
      </h2>
      <p className="wr-body wr-rise" style={{ animationDelay: '120ms' }}>
        <span className="wr-num">{formatCount(thing.reads)}</span> reads, and you kept coming back.
      </p>
      {thing.unusual_pair ? (
        <p className="wr-big wr-rise" style={{ animationDelay: '220ms' }}>
          Few finalists read {thing.unusual_pair[0]} and {thing.unusual_pair[1]} in the same year. You did.
        </p>
      ) : thing.gani ? (
        <p className="wr-big wr-rise" style={{ animationDelay: '220ms' }}>
          {thing.gani.subject} all year? A little {GANI_FIGURES[thing.gani.figure]} in you.
        </p>
      ) : null}
      <div className="wr-art" aria-hidden />
    </Frame>
  );
}

/* 05 ── You no gree */
function NoGree({ record }: { record: WrappedRecord }) {
  const gree = record.no_gree;
  const league = gree.campus_league;
  return (
    <Frame slide={5} label="You no gree">
      <p className="wr-kicker wr-rise">You no gree</p>
      <p className="wr-huge wr-rise" style={accent}>
        {formatCount(gree.longest_streak)}
      </p>
      <p className="wr-big wr-rise">{gree.longest_streak === 1 ? 'day in a row.' : 'days in a row.'}</p>
      <ul className="wr-body wr-rise" style={{ display: 'grid', gap: '2cqw', animationDelay: '120ms' }}>
        <li>
          <strong className="wr-num">{formatCount(gree.days_active)}</strong> days studied.
        </li>
        <li>
          Revision week: <strong className="wr-num">{Math.min(5, Math.max(0, gree.revision_week_days))} of 5</strong>.
        </li>
        {gree.weekend_share_pct > 0 ? (
          <li>
            <strong className="wr-num">{Math.round(gree.weekend_share_pct)}%</strong> of your reading happened on weekends.
          </li>
        ) : null}
      </ul>
      {league ? (
        <p className="wr-body wr-rise" style={{ marginTop: 'auto', animationDelay: '220ms' }}>
          {CAMPUS_NAMES[league.top_campus]} read the most judgments per finalist this year.
          {record.student.campus && record.student.campus !== league.top_campus ? (
            <>
              {' '}
              Your campus came <strong>{ordinal(league.rank)}</strong>.
            </>
          ) : record.student.campus === league.top_campus ? (
            <> That&rsquo;s your campus.</>
          ) : null}
        </p>
      ) : null}
    </Frame>
  );
}

/* 06 ── Drafting? Light work */
function Drafting({ record }: { record: WrappedRecord }) {
  const draft = record.drafting;
  if (!draft) return null;
  const rise = draft.quiz_rise;
  return (
    <Frame slide={6} label="Drafting? Light work">
      <p className="wr-kicker wr-rise">Drafting? Light work.</p>
      {draft.words_written > 0 ? (
        <>
          <h2 className="wr-title wr-rise">
            Lawexa wrote <span style={accent}>{formatWords(draft.words_written)}</span> words for you.
          </h2>
          {draft.novels >= 1 ? (
            <p className="wr-body wr-rise" style={{ animationDelay: '120ms' }}>
              That&rsquo;s about <strong className="wr-num">{formatCount(draft.novels)}</strong> {draft.novels === 1 ? 'novel' : 'novels'}.
            </p>
          ) : null}
        </>
      ) : null}
      <ul className="wr-body wr-rise" style={{ display: 'grid', gap: '2cqw', animationDelay: '200ms' }}>
        {draft.mocks_answered > 0 ? (
          <li>
            <strong className="wr-num">{formatCount(draft.mocks_answered)}</strong> mock questions answered.
          </li>
        ) : null}
        {draft.best_mock_pct !== null && draft.best_mock_pct > 0 ? (
          <li>
            Best mock: <strong className="wr-num">{Math.round(draft.best_mock_pct)}%</strong>.
          </li>
        ) : null}
      </ul>
      {rise ? (
        <p className="wr-big wr-rise" style={{ marginTop: 'auto', animationDelay: '260ms' }}>
          {courseName(rise.course_key, record)}: {Math.round(rise.from_pct)}% in {rise.from_month},{' '}
          <span style={accent}>
            {Math.round(rise.to_pct)}% in {rise.to_month}
          </span>
          .
        </p>
      ) : null}
    </Frame>
  );
}

/* 07 ── Your Bar Finals personality */
function Personality({ record }: { record: WrappedRecord }) {
  const persona = PERSONAS[record.persona.key] ?? PERSONAS.steady_learned_friend;
  const reason = personaReason(record.persona.reason);
  const percentile = percentileLine(record.percentile);
  const others = PERSONA_ORDER.filter((key) => key !== record.persona.key).map((key) => PERSONAS[key].name);
  return (
    <Frame slide={7} label="Your Bar Finals personality">
      <p className="wr-big wr-rise" aria-label={CAMPAIGN_LINE.join(' ')}>
        {CAMPAIGN_LINE.map((part, i) => (
          <span key={part} style={{ display: 'block', ...(i === CAMPAIGN_LINE.length - 1 ? accent : {}) }}>
            {part}
          </span>
        ))}
      </p>
      <p className="wr-kicker wr-rise" style={{ marginTop: '4cqw' }}>
        Your Bar Finals personality
      </p>
      <span className="wr-sticker wr-rise" data-tone="ink" style={{ fontSize: '7cqw', padding: '3.4cqw 5.4cqw', animationDelay: '120ms' }}>
        {persona.name}
      </span>
      <p className="wr-body wr-rise" style={{ animationDelay: '200ms' }}>
        {reason ?? persona.line}
      </p>
      {percentile ? (
        <p className="wr-body wr-rise" style={{ fontWeight: 700, animationDelay: '260ms' }}>
          {percentile}
        </p>
      ) : null}
      <p className="wr-small wr-rise" style={{ marginTop: 'auto', animationDelay: '320ms' }}>
        Also in the class: {others.join(', ')}.
      </p>
    </Frame>
  );
}

const FRAMES: Record<Exclude<WrappedSlideNumber, 8>, (props: { record: WrappedRecord }) => ReactNode> = {
  1: ReportSlip,
  2: Overnight,
  3: BigFive,
  4: Obsession,
  5: NoGree,
  6: Drafting,
  7: Personality,
};

/** Frames 01 to 07. Frame 08, the share card, is its own screen (ShareFrame). */
export function StoryFrame({ slide, record }: { slide: Exclude<WrappedSlideNumber, 8>; record: WrappedRecord }) {
  const Component = FRAMES[slide];
  return <Component record={record} />;
}
