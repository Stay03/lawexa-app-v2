import { LawyerInfo } from '@/components/chat/lawyer-card';
import { QuizInfo } from './parse-quiz-xml';

export interface DeepResearchPromptInfo {
  title: string;
  message: string;
  querySummary: string;
  estimatedSources: string[];
  actions: Array<{ id: string; label: string }>;
}

export interface MultiQuestionPromptInfo {
  title: string;
  description: string;
  questionCount: number;
  questions: Array<{ index: number; summary: string }>;
  actions: Array<{ id: string; label: string }>;
}

export interface NextQuestionPromptInfo {
  current: number;
  total: number;
  nextSummary: string;
  actions: Array<{ id: string; label: string }>;
}

export interface MultiQuestionPlanInfo {
  title: string;
  description: string;
  questionCount: number;
  questions: Array<{ index: number; summary: string }>;
  currentQuestionIndex: number;
  actions: Array<{ id: string; label: string }>;
}

export interface MultiQuestionProgressInfo {
  completedIndex: number;
  nextIndex: number;
  remaining: number;
}

export interface ExecutionPlanInfo {
  /** Multi-question plan variant */
  totalQuestions?: number;
  questions?: Array<{
    index: number;
    summary: string;
    classification: string;
    pipeline: string;
  }>;
  /** Single-question agent routing variant */
  querySummary?: string;
  classification?: string;
  pipeline?: string;
  agents?: Array<{
    order: number;
    name: string;
    reason: string;
  }>;
  writerNeeded?: boolean;
}

export interface MultiQuestionCompleteInfo {
  totalAnswered: number;
  summary: string;
}

export interface NoteLinkInfo {
  title: string;
  url: string;
  downloadUrl?: string;
}

/** Element being streamed but not yet closed — drives the "generating…" pill. */
export type GeneratingElement =
  | 'quiz'
  | 'lawyers'
  | 'deep_research'
  | 'execution_plan'
  | 'multi_question'
  | 'note_link';

export type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'lawyers'; lawyers: LawyerInfo[] }
  | { type: 'quizzes'; quizzes: QuizInfo[] }
  | { type: 'deep_research_prompt'; prompt: DeepResearchPromptInfo }
  | { type: 'multi_question_prompt'; prompt: MultiQuestionPromptInfo }
  | { type: 'next_question_prompt'; prompt: NextQuestionPromptInfo }
  | { type: 'multi_question_plan'; plan: MultiQuestionPlanInfo }
  | { type: 'multi_question_progress'; progress: MultiQuestionProgressInfo }
  | { type: 'execution_plan'; plan: ExecutionPlanInfo }
  | { type: 'multi_question_complete'; info: MultiQuestionCompleteInfo }
  | { type: 'note_link'; note: NoteLinkInfo }
  | { type: 'generating'; element: GeneratingElement; raw: string };

export interface ParsedContent {
  segments: ContentSegment[];
}

function getTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

// Lawyer parsing helpers
function parseSingleLawyer(lawyerXml: string): LawyerInfo {
  return {
    id: getTagContent(lawyerXml, 'id'),
    name: getTagContent(lawyerXml, 'name'),
    email: getTagContent(lawyerXml, 'email'),
    location: getTagContent(lawyerXml, 'location'),
    lawSchool: getTagContent(lawyerXml, 'law_school'),
    firmName: getTagContent(lawyerXml, 'firm_name'),
    firmLogoUrl: getTagContent(lawyerXml, 'firm_logo_url'),
    avatarUrl: getTagContent(lawyerXml, 'avatar_url') || undefined,
    linkedinUrl: getTagContent(lawyerXml, 'linkedin_url') || undefined,
    practiceArea: getTagContent(lawyerXml, 'practice_area') || undefined,
  };
}

function extractLawyersFromBlock(xml: string): LawyerInfo[] {
  const lawyerRegex = /<lawyer>([\s\S]*?)<\/lawyer>/gi;
  const lawyers: LawyerInfo[] = [];
  let match;

  while ((match = lawyerRegex.exec(xml)) !== null) {
    lawyers.push(parseSingleLawyer(match[0]));
  }

  return lawyers;
}

// Quiz parsing helpers
function extractQuizOptions(
  optionsXml: string
): Array<{ id: string; text: string }> {
  const optionRegex = /<option\s+id="([^"]+)">([\s\S]*?)<\/option>/gi;
  const options: Array<{ id: string; text: string }> = [];
  let match;

  while ((match = optionRegex.exec(optionsXml)) !== null) {
    options.push({ id: match[1], text: match[2].trim() });
  }

  return options;
}

function parseSingleQuiz(quizXml: string): QuizInfo {
  const optionsBlock = getTagContent(quizXml, 'options');

  return {
    type: 'mcq',
    question: getTagContent(quizXml, 'question'),
    options: extractQuizOptions(optionsBlock),
    answer: getTagContent(quizXml, 'answer'),
    explanation: getTagContent(quizXml, 'explanation'),
    source: getTagContent(quizXml, 'source') || undefined,
  };
}

function extractQuizzesFromBlock(xml: string): QuizInfo[] {
  const quizRegex = /<quiz>([\s\S]*?)<\/quiz>/gi;
  const quizzes: QuizInfo[] = [];
  let match;

  while ((match = quizRegex.exec(xml)) !== null) {
    quizzes.push(parseSingleQuiz(match[0]));
  }

  return quizzes;
}

// Deep research prompt parsing helpers
function extractActions(xml: string): Array<{ id: string; label: string }> {
  const actionRegex = /<action\s+id="([^"]+)"\s+label="([^"]+)"\s*\/>/gi;
  const actions: Array<{ id: string; label: string }> = [];
  let match;

  while ((match = actionRegex.exec(xml)) !== null) {
    actions.push({ id: match[1], label: match[2] });
  }

  return actions;
}

function parseDeepResearchPrompt(xml: string): DeepResearchPromptInfo {
  const actionsBlock = getTagContent(xml, 'actions');
  const sourcesRaw = getTagContent(xml, 'estimated_sources');

  return {
    title: getTagContent(xml, 'title'),
    message: getTagContent(xml, 'message'),
    querySummary: getTagContent(xml, 'query_summary'),
    estimatedSources: sourcesRaw
      ? sourcesRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    actions: extractActions(actionsBlock),
  };
}

function parseMultiQuestionPrompt(xml: string): MultiQuestionPromptInfo {
  const actionsBlock = getTagContent(xml, 'actions');
  const questionsBlock = getTagContent(xml, 'questions');
  const questionRegex = /<question\s+index="(\d+)">([\s\S]*?)<\/question>/gi;
  const questions: Array<{ index: number; summary: string }> = [];
  let match;

  while ((match = questionRegex.exec(questionsBlock)) !== null) {
    questions.push({ index: parseInt(match[1], 10), summary: match[2].trim() });
  }

  return {
    title: getTagContent(xml, 'title'),
    description: getTagContent(xml, 'description'),
    questionCount: parseInt(getTagContent(xml, 'question_count'), 10) || questions.length,
    questions,
    actions: extractActions(actionsBlock),
  };
}

function parseNextQuestionPrompt(xml: string): NextQuestionPromptInfo {
  const actionsBlock = getTagContent(xml, 'actions');

  return {
    current: parseInt(getTagContent(xml, 'current'), 10) || 0,
    total: parseInt(getTagContent(xml, 'total'), 10) || 0,
    nextSummary: getTagContent(xml, 'next_summary'),
    actions: extractActions(actionsBlock),
  };
}

function parseMultiQuestionPlan(xml: string): MultiQuestionPlanInfo {
  const actionsBlock = getTagContent(xml, 'actions');
  const questionsBlock = getTagContent(xml, 'questions');
  const questionRegex = /<question\s+index="(\d+)">([\s\S]*?)<\/question>/gi;
  const questions: Array<{ index: number; summary: string }> = [];
  let match;

  while ((match = questionRegex.exec(questionsBlock)) !== null) {
    questions.push({ index: parseInt(match[1], 10), summary: match[2].trim() });
  }

  // Extract current_question index from self-closing tag
  const currentQuestionMatch = xml.match(/<current_question\s+index="(\d+)"\s*\/>/i);
  const currentQuestionIndex = currentQuestionMatch ? parseInt(currentQuestionMatch[1], 10) : 1;

  return {
    title: getTagContent(xml, 'title'),
    description: getTagContent(xml, 'description'),
    questionCount: parseInt(getTagContent(xml, 'question_count'), 10) || questions.length,
    questions,
    currentQuestionIndex,
    actions: extractActions(actionsBlock),
  };
}

function parseMultiQuestionProgress(xml: string): MultiQuestionProgressInfo {
  const completedMatch = xml.match(/<completed\s+index="(\d+)"\s*\/>/i);
  const nextMatch = xml.match(/<next\s+index="(\d+)"\s*\/>/i);

  return {
    completedIndex: completedMatch ? parseInt(completedMatch[1], 10) : 0,
    nextIndex: nextMatch ? parseInt(nextMatch[1], 10) : 0,
    remaining: parseInt(getTagContent(xml, 'remaining'), 10) || 0,
  };
}

function parseExecutionPlan(xml: string): ExecutionPlanInfo {
  const totalQuestions = parseInt(getTagContent(xml, 'total_questions'), 10) || 0;

  if (totalQuestions > 0) {
    // Multi-question variant
    const questionsBlock = getTagContent(xml, 'questions');
    const questionRegex = /<question\s+index="(\d+)">([\s\S]*?)<\/question>/gi;
    const questions: ExecutionPlanInfo['questions'] = [];
    let m;
    while ((m = questionRegex.exec(questionsBlock)) !== null) {
      questions.push({
        index: parseInt(m[1], 10),
        summary: getTagContent(m[2], 'summary') || m[2].trim(),
        classification: getTagContent(m[2], 'classification') || '',
        pipeline: getTagContent(m[2], 'pipeline') || '',
      });
    }
    return { totalQuestions, questions };
  }

  // Single-question agent routing variant
  const agentsBlock = getTagContent(xml, 'agents');
  const agentRegex = /<agent\s+order="(\d+)">([\s\S]*?)<\/agent>/gi;
  const agents: ExecutionPlanInfo['agents'] = [];
  let m;
  while ((m = agentRegex.exec(agentsBlock)) !== null) {
    agents.push({
      order: parseInt(m[1], 10),
      name: getTagContent(m[2], 'name') || m[2].trim(),
      reason: getTagContent(m[2], 'reason') || '',
    });
  }

  return {
    querySummary: getTagContent(xml, 'query_summary'),
    classification: getTagContent(xml, 'classification'),
    pipeline: getTagContent(xml, 'pipeline'),
    agents: agents.length > 0 ? agents : undefined,
    writerNeeded: getTagContent(xml, 'writer_needed').toLowerCase() === 'yes',
  };
}

function parseMultiQuestionComplete(xml: string): MultiQuestionCompleteInfo {
  return {
    totalAnswered: parseInt(getTagContent(xml, 'total_answered'), 10) || 0,
    summary: getTagContent(xml, 'summary'),
  };
}

function parseNoteLink(xml: string): NoteLinkInfo {
  return {
    title: getTagContent(xml, 'title'),
    url: getTagContent(xml, 'url'),
    downloadUrl: getTagContent(xml, 'download') || undefined,
  };
}

interface MatchInfo {
  start: number;
  end: number;
  segment: ContentSegment;
}

// Known special tags whose in-progress (opened but not yet closed) form should
// render as a lightweight "generating…" pill during streaming, mapped to the
// indicator's element key. Order longest/container-first so an outer <quizzes>
// wins over its inner <quiz> when both are still open.
const INCOMPLETE_TAGS: Array<{ tag: string; element: GeneratingElement }> = [
  { tag: 'lawyers', element: 'lawyers' },
  { tag: 'lawyer', element: 'lawyers' },
  { tag: 'quizzes', element: 'quiz' },
  { tag: 'quiz', element: 'quiz' },
  { tag: 'deep_research_prompt', element: 'deep_research' },
  { tag: 'multi_question_prompt', element: 'multi_question' },
  { tag: 'next_question_prompt', element: 'multi_question' },
  { tag: 'multi_question_plan', element: 'multi_question' },
  { tag: 'multi_question_progress', element: 'multi_question' },
  { tag: 'multi_question_complete', element: 'multi_question' },
  { tag: 'execution_plan', element: 'execution_plan' },
  { tag: 'note_link', element: 'note_link' },
];

/**
 * If `text` holds an opening special tag with no matching closing tag (a block
 * still being streamed), return the clean text before it plus the element key.
 * Otherwise the whole string comes back as `before` with a null element.
 */
function splitTrailingIncomplete(text: string): {
  before: string;
  element: GeneratingElement | null;
  raw: string;
} {
  let best: { index: number; element: GeneratingElement } | null = null;

  for (const { tag, element } of INCOMPLETE_TAGS) {
    // `<tag>` or `<tag attr="…">` — the trailing `>` guards against matching a
    // longer sibling (e.g. the `quiz` pattern will not match `<quizzes>`).
    const openRegex = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi');
    let openMatch: RegExpExecArray | null;
    while ((openMatch = openRegex.exec(text)) !== null) {
      const afterOpen = text.slice(openMatch.index + openMatch[0].length);
      if (!new RegExp(`</${tag}>`, 'i').test(afterOpen)) {
        if (!best || openMatch.index < best.index) {
          best = { index: openMatch.index, element };
        }
        break; // earliest unclosed occurrence for this tag is enough
      }
    }
  }

  if (best) {
    return {
      before: text.slice(0, best.index),
      element: best.element,
      raw: text.slice(best.index),
    };
  }
  return { before: text, element: null, raw: '' };
}

// Grouping wrappers that batch several inner items into a single rendered card.
// While one of these is still open, its inner items must not render one-by-one.
const CONTAINER_TAGS: Array<{ tag: string; element: GeneratingElement }> = [
  { tag: 'quizzes', element: 'quiz' },
  { tag: 'lawyers', element: 'lawyers' },
];

/**
 * The earliest grouping wrapper (`<quizzes>`/`<lawyers>`) that has opened but not
 * yet closed, or null. A complete wrapper earlier in the content is skipped.
 */
function findUnclosedContainer(
  content: string
): { index: number; element: GeneratingElement } | null {
  let best: { index: number; element: GeneratingElement } | null = null;

  for (const { tag, element } of CONTAINER_TAGS) {
    const openRegex = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi');
    let openMatch: RegExpExecArray | null;
    while ((openMatch = openRegex.exec(content)) !== null) {
      const afterOpen = content.slice(openMatch.index + openMatch[0].length);
      if (!new RegExp(`</${tag}>`, 'i').test(afterOpen)) {
        if (!best || openMatch.index < best.index) {
          best = { index: openMatch.index, element };
        }
        break;
      }
    }
  }

  return best;
}

export function parseContent(content: string): ParsedContent {
  // A grouping wrapper (<quizzes>/<lawyers>) that hasn't closed yet means the
  // whole batch is still being generated — its inner items reflow into one card
  // once it closes. Render whatever cleanly precedes it, then a single
  // "generating" segment, instead of popping inner items in one at a time.
  const openContainer = findUnclosedContainer(content);
  if (openContainer) {
    const head = content.slice(0, openContainer.index);
    const headSegments = head.trim() ? parseContent(head).segments : [];
    return {
      segments: [
        ...headSegments,
        {
          type: 'generating',
          element: openContainer.element,
          raw: content.slice(openContainer.index),
        },
      ],
    };
  }

  const segments: ContentSegment[] = [];
  const matches: MatchInfo[] = [];

  // ---- Find lawyer blocks ----

  // <lawyers>...</lawyers> blocks
  const lawyersBlockRegex = /<lawyers>([\s\S]*?)<\/lawyers>/gi;
  let match;

  while ((match = lawyersBlockRegex.exec(content)) !== null) {
    const lawyers = extractLawyersFromBlock(match[0]);
    if (lawyers.length > 0) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'lawyers', lawyers },
      });
    }
  }

  // Standalone <lawyer>...</lawyer> blocks
  const singleLawyerRegex = /<lawyer>([\s\S]*?)<\/lawyer>/gi;

  while ((match = singleLawyerRegex.exec(content)) !== null) {
    const isInsideLawyersBlock = matches.some(
      (m) =>
        m.segment.type === 'lawyers' &&
        match!.index >= m.start &&
        match!.index < m.end
    );

    if (!isInsideLawyersBlock) {
      const lawyer = parseSingleLawyer(match[0]);
      if (lawyer.name) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          segment: { type: 'lawyers', lawyers: [lawyer] },
        });
      }
    }
  }

  // ---- Find quiz blocks ----

  // <quizzes>...</quizzes> blocks
  const quizzesBlockRegex = /<quizzes[^>]*>([\s\S]*?)<\/quizzes>/gi;

  while ((match = quizzesBlockRegex.exec(content)) !== null) {
    const quizzes = extractQuizzesFromBlock(match[0]);
    if (quizzes.length > 0) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'quizzes', quizzes },
      });
    }
  }

  // Standalone <quiz>...</quiz> blocks
  const singleQuizRegex = /<quiz[^>]*>([\s\S]*?)<\/quiz>/gi;

  while ((match = singleQuizRegex.exec(content)) !== null) {
    const isInsideQuizzesBlock = matches.some(
      (m) =>
        m.segment.type === 'quizzes' &&
        match!.index >= m.start &&
        match!.index < m.end
    );

    if (!isInsideQuizzesBlock) {
      const quiz = parseSingleQuiz(match[0]);
      if (quiz.question) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          segment: { type: 'quizzes', quizzes: [quiz] },
        });
      }
    }
  }

  // ---- Find deep research prompt blocks ----
  const deepResearchRegex = /<deep_research_prompt>([\s\S]*?)<\/deep_research_prompt>/gi;

  while ((match = deepResearchRegex.exec(content)) !== null) {
    const prompt = parseDeepResearchPrompt(match[0]);
    if (prompt.title) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'deep_research_prompt', prompt },
      });
    }
  }

  // ---- Find multi question prompt blocks ----
  const multiQuestionRegex = /<multi_question_prompt>([\s\S]*?)<\/multi_question_prompt>/gi;

  while ((match = multiQuestionRegex.exec(content)) !== null) {
    const prompt = parseMultiQuestionPrompt(match[0]);
    if (prompt.title) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'multi_question_prompt', prompt },
      });
    }
  }

  // ---- Find next question prompt blocks ----
  const nextQuestionRegex = /<next_question_prompt>([\s\S]*?)<\/next_question_prompt>/gi;

  while ((match = nextQuestionRegex.exec(content)) !== null) {
    const prompt = parseNextQuestionPrompt(match[0]);
    if (prompt.total > 0) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'next_question_prompt', prompt },
      });
    }
  }

  // ---- Find multi question plan blocks ----
  const multiQuestionPlanRegex = /<multi_question_plan>([\s\S]*?)<\/multi_question_plan>/gi;

  while ((match = multiQuestionPlanRegex.exec(content)) !== null) {
    const plan = parseMultiQuestionPlan(match[0]);
    if (plan.title) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'multi_question_plan', plan },
      });
    }
  }

  // ---- Find multi question progress blocks ----
  const multiQuestionProgressRegex = /<multi_question_progress>([\s\S]*?)<\/multi_question_progress>/gi;

  while ((match = multiQuestionProgressRegex.exec(content)) !== null) {
    const progress = parseMultiQuestionProgress(match[0]);
    if (progress.completedIndex > 0 || progress.nextIndex > 0) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'multi_question_progress', progress },
      });
    }
  }

  // ---- Find execution plan blocks ----
  const executionPlanRegex = /<execution_plan>([\s\S]*?)<\/execution_plan>/gi;

  while ((match = executionPlanRegex.exec(content)) !== null) {
    const plan = parseExecutionPlan(match[0]);
    if (plan.totalQuestions || plan.querySummary) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'execution_plan', plan },
      });
    }
  }

  // ---- Find multi question complete blocks ----
  const multiQuestionCompleteRegex = /<multi_question_complete>([\s\S]*?)<\/multi_question_complete>/gi;

  while ((match = multiQuestionCompleteRegex.exec(content)) !== null) {
    const info = parseMultiQuestionComplete(match[0]);
    if (info.totalAnswered > 0) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'multi_question_complete', info },
      });
    }
  }

  // ---- Find note link blocks ----
  const noteLinkRegex = /<note_link>([\s\S]*?)<\/note_link>/gi;

  while ((match = noteLinkRegex.exec(content)) !== null) {
    const note = parseNoteLink(match[0]);
    if (note.title && note.url) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: 'note_link', note },
      });
    }
  }

  // Sort all matches by position
  matches.sort((a, b) => a.start - b.start);

  // Build segments with text in between
  let lastEnd = 0;

  for (const m of matches) {
    // Add text before this match
    if (m.start > lastEnd) {
      const textContent = content.slice(lastEnd, m.start).trim();
      if (textContent) {
        segments.push({ type: 'text', content: textContent });
      }
    }

    // Add the matched segment
    segments.push(m.segment);
    lastEnd = m.end;
  }

  // Add remaining text after the last complete match. During streaming this tail
  // may hold an in-progress (unclosed) special block — surface it as a lightweight
  // "generating" segment instead of leaking the raw XML into the markdown.
  if (lastEnd < content.length) {
    const tail = content.slice(lastEnd);
    const { before, element, raw } = splitTrailingIncomplete(tail);
    const beforeContent = before.trim();
    if (beforeContent) {
      segments.push({ type: 'text', content: beforeContent });
    }
    if (element) {
      segments.push({ type: 'generating', element, raw });
    }
  }

  // If nothing matched and there was no in-progress block, keep the raw content
  // as a single text segment (unchanged fallback).
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: 'text', content: content });
  }

  return { segments };
}

export function hasPromptContent(content: string): boolean {
  return (
    /<deep_research_prompt/i.test(content) ||
    /<multi_question_prompt/i.test(content) ||
    /<next_question_prompt/i.test(content) ||
    /<multi_question_plan/i.test(content) ||
    /<multi_question_progress/i.test(content)
  );
}

export function hasSpecialContent(content: string): boolean {
  return (
    /<lawyer/i.test(content) ||
    /<lawyers/i.test(content) ||
    /<quiz(?:\s|>)/i.test(content) ||
    /<quizzes(?:\s|>)/i.test(content) ||
    /<deep_research_prompt/i.test(content) ||
    /<multi_question_prompt/i.test(content) ||
    /<next_question_prompt/i.test(content) ||
    /<multi_question_plan/i.test(content) ||
    /<multi_question_progress/i.test(content) ||
    /<execution_plan/i.test(content) ||
    /<multi_question_complete/i.test(content) ||
    /<note_link/i.test(content)
  );
}
