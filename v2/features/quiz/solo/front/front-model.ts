import type { QuizQuestion, QuizScenario, QuizSource } from '@/types/channel-quiz';

/**
 * front-model — "What is in it" on a quiz's page (quiz piece 3, Stay, 23
 * October 2026, picture 4). Until Arthur answers "show the first 2 questions,
 * or all of them", the page names no question: it says how many stand on
 * their own and, for each scenario, its title and how many questions it has.
 * A scenario with no title is "Scenario 2", by its place in the quiz.
 */

export interface ContentsLine {
  readonly key: string;
  readonly label: string;
  /** How many questions the line covers. */
  readonly count: number;
  /** A scenario's source, shown under its line to everyone (the quiz builder, 24 October 2026). */
  readonly source?: QuizSource | null;
}

export function quizContents(
  questions: readonly Pick<QuizQuestion, 'scenario_uuid'>[],
  scenarios: readonly (Pick<QuizScenario, 'uuid' | 'title' | 'position'> & Partial<Pick<QuizScenario, 'source'>>)[],
): ContentsLine[] {
  const perScenario = new Map<string, number>();
  let standalone = 0;
  for (const question of questions) {
    const scenario = question.scenario_uuid ?? null;
    if (scenario === null) standalone += 1;
    else perScenario.set(scenario, (perScenario.get(scenario) ?? 0) + 1);
  }
  const lines: ContentsLine[] = [];
  if (standalone > 0) {
    lines.push({
      key: 'standalone',
      label: `${standalone} ${standalone === 1 ? 'question' : 'questions'} on ${standalone === 1 ? 'its' : 'their'} own`,
      count: standalone,
    });
  }
  [...scenarios]
    .sort((a, b) => a.position - b.position)
    .forEach((scenario, index) => {
      const count = perScenario.get(scenario.uuid) ?? 0;
      if (count === 0) return;
      const name = scenario.title?.trim() || `Scenario ${index + 1}`;
      lines.push({
        key: scenario.uuid,
        label: `${name} · ${count} ${count === 1 ? 'question' : 'questions'}`,
        count,
        source: scenario.source ?? null,
      });
    });
  return lines;
}

/** "Taken 3 times", "Taken once"; nothing before the first finished attempt. */
export function takenLabel(attempts: number | null | undefined): string | null {
  if (typeof attempts !== 'number' || attempts <= 0) return null;
  return attempts === 1 ? 'Taken once' : `Taken ${attempts} times`;
}
