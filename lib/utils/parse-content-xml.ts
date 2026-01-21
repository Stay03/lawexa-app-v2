import { LawyerInfo } from '@/components/chat/lawyer-card';
import { QuizInfo } from './parse-quiz-xml';

export type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'lawyers'; lawyers: LawyerInfo[] }
  | { type: 'quizzes'; quizzes: QuizInfo[] };

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

interface MatchInfo {
  start: number;
  end: number;
  segment: ContentSegment;
}

export function parseContent(content: string): ParsedContent {
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

  // Add remaining text after last match
  if (lastEnd < content.length) {
    const textContent = content.slice(lastEnd).trim();
    if (textContent) {
      segments.push({ type: 'text', content: textContent });
    }
  }

  // If no matches found, return content as single text segment
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: 'text', content: content });
  }

  return { segments };
}

export function hasSpecialContent(content: string): boolean {
  return (
    /<lawyer/i.test(content) ||
    /<lawyers/i.test(content) ||
    /<quiz(?:\s|>)/i.test(content) ||
    /<quizzes(?:\s|>)/i.test(content)
  );
}
