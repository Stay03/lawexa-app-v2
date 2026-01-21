import { LawyerInfo } from '@/components/chat/lawyer-card';

interface ParsedContent {
  segments: Array<{ type: 'text'; content: string } | { type: 'lawyers'; lawyers: LawyerInfo[] }>;
}

function getTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

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

function extractLawyersFromMultipleTag(xml: string): LawyerInfo[] {
  const lawyerRegex = /<lawyer>([\s\S]*?)<\/lawyer>/gi;
  const lawyers: LawyerInfo[] = [];
  let match;

  while ((match = lawyerRegex.exec(xml)) !== null) {
    lawyers.push(parseSingleLawyer(match[0]));
  }

  return lawyers;
}

export function parseLawyerContent(content: string): ParsedContent {
  const segments: ParsedContent['segments'] = [];

  // Combined regex to match both <lawyers>...</lawyers> and standalone <lawyer>...</lawyer>
  const lawyersBlockRegex = /<lawyers>([\s\S]*?)<\/lawyers>/gi;
  const singleLawyerRegex = /<lawyer>([\s\S]*?)<\/lawyer>/gi;

  // First, find all matches and their positions
  const matches: Array<{ start: number; end: number; lawyers: LawyerInfo[] }> = [];

  // Find <lawyers> blocks (multiple lawyers)
  let match;
  while ((match = lawyersBlockRegex.exec(content)) !== null) {
    const lawyers = extractLawyersFromMultipleTag(match[0]);
    if (lawyers.length > 0) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        lawyers,
      });
    }
  }

  // Find standalone <lawyer> blocks (not inside <lawyers>)
  while ((match = singleLawyerRegex.exec(content)) !== null) {
    // Check if this match is inside any <lawyers> block
    const isInsideLawyersBlock = matches.some(
      (m) => match!.index >= m.start && match!.index < m.end
    );

    if (!isInsideLawyersBlock) {
      const lawyer = parseSingleLawyer(match[0]);
      if (lawyer.name) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          lawyers: [lawyer],
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

    // Add lawyers segment
    segments.push({ type: 'lawyers', lawyers: m.lawyers });
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

export function hasLawyerContent(content: string): boolean {
  return /<lawyer>/i.test(content) || /<lawyers>/i.test(content);
}
