export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizInfo {
  type: 'mcq';
  question: string;
  options: QuizOption[];
  answer: string;
  explanation: string;
  source?: string;
}

function getTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractOptions(optionsXml: string): QuizOption[] {
  const optionRegex = /<option\s+id="([^"]+)">([\s\S]*?)<\/option>/gi;
  const options: QuizOption[] = [];
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
    options: extractOptions(optionsBlock),
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

export interface ParsedQuizContent {
  segments: Array<
    { type: 'text'; content: string } | { type: 'quizzes'; quizzes: QuizInfo[] }
  >;
}

export function parseQuizContent(content: string): ParsedQuizContent {
  const segments: ParsedQuizContent['segments'] = [];

  // Match both <quizzes>...</quizzes> and standalone <quiz type="mcq">...</quiz>
  const quizzesBlockRegex = /<quizzes[^>]*>([\s\S]*?)<\/quizzes>/gi;
  const singleQuizRegex = /<quiz[^>]*>([\s\S]*?)<\/quiz>/gi;

  // Find all matches and their positions
  const matches: Array<{ start: number; end: number; quizzes: QuizInfo[] }> =
    [];

  // Find <quizzes> blocks (multiple quizzes)
  let match;
  while ((match = quizzesBlockRegex.exec(content)) !== null) {
    const quizzes = extractQuizzesFromBlock(match[0]);
    if (quizzes.length > 0) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        quizzes,
      });
    }
  }

  // Find standalone <quiz> blocks (not inside <quizzes>)
  while ((match = singleQuizRegex.exec(content)) !== null) {
    // Check if this match is inside any <quizzes> block
    const isInsideQuizzesBlock = matches.some(
      (m) => match!.index >= m.start && match!.index < m.end
    );

    if (!isInsideQuizzesBlock) {
      const quiz = parseSingleQuiz(match[0]);
      if (quiz.question) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          quizzes: [quiz],
        });
      }
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  // Build segments
  let lastEnd = 0;

  for (const m of matches) {
    // Add text before this match
    if (m.start > lastEnd) {
      const textContent = content.slice(lastEnd, m.start).trim();
      if (textContent) {
        segments.push({ type: 'text', content: textContent });
      }
    }

    // Add quizzes segment
    segments.push({ type: 'quizzes', quizzes: m.quizzes });
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

export function hasQuizContent(content: string): boolean {
  return /<quiz(?:\s|>)/i.test(content) || /<quizzes(?:\s|>)/i.test(content);
}
