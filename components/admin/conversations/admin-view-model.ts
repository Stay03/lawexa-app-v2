import type { AdminConversationOwner, AdminTurnAttribution, AdminViewMessage } from '@/types/admin-conversation-view';

/**
 * The admin conversation view's facts (Stay, thread 085a980c, 25 November
 * 2026): the chat draws with the owner's own components, and these are the
 * staff lines around it. Pure, so the sums are tested.
 */

/** What one turn cost: every AI call between a question and the next one. */
export interface TurnFacts {
  promptTokens: number;
  completionTokens: number;
  /** The shown cost: actual where the provider reported it, else the estimate. */
  cost: number;
  /** True when any call in the turn has no actual cost yet. */
  estimated: boolean;
  /** How many AI calls the turn made. */
  calls: number;
  /** The models the turn used, in order, each once. */
  models: string[];
  /** The slowest call, in ms; null when none says. */
  slowestMs: number | null;
  /** What paid for the turn; null for a staff account or an older row. */
  funding: AdminTurnAttribution | null;
}

/** The transcript row id `transformApiMessages` gives a server message. */
export function rowIdOf(messageId: number): string {
  return `msg_${messageId}`;
}

/**
 * Each turn's facts, keyed by the row they show under: the turn's last
 * assistant row that is on screen (`answerRows`). A turn with no answer on
 * screen (it failed before one) has no line; the chat's totals still count it.
 */
export function turnFactsByRow(
  messages: readonly AdminViewMessage[],
  answerRows: ReadonlySet<string>,
): Map<string, TurnFacts> {
  const byRow = new Map<string, TurnFacts>();
  let turn: AdminViewMessage[] = [];
  const close = () => {
    const anchor = [...turn].reverse().find((message) => message.role === 'assistant' && answerRows.has(rowIdOf(message.id)));
    const facts = factsOf(turn);
    if (anchor && facts) byRow.set(rowIdOf(anchor.id), facts);
    turn = [];
  };
  for (const message of messages) {
    if (message.role === 'user') close();
    turn.push(message);
  }
  close();
  return byRow;
}

function factsOf(turn: readonly AdminViewMessage[]): TurnFacts | null {
  const used = turn.filter((message) => message.usage);
  const funding = turn.find((message) => message.attribution)?.attribution ?? null;
  if (used.length === 0) return null;
  const models: string[] = [];
  let slowestMs: number | null = null;
  const facts: TurnFacts = { promptTokens: 0, completionTokens: 0, cost: 0, estimated: false, calls: used.length, models, slowestMs, funding };
  for (const { usage } of used) {
    if (!usage) continue;
    facts.promptTokens += usage.prompt_tokens;
    facts.completionTokens += usage.completion_tokens;
    facts.cost += usage.cost;
    if (usage.actual_cost === null) facts.estimated = true;
    const name = usage.model?.name;
    if (name && !models.includes(name)) models.push(name);
    if (usage.latency_ms !== null && (slowestMs === null || usage.latency_ms > slowestMs)) slowestMs = usage.latency_ms;
  }
  facts.slowestMs = slowestMs;
  return facts;
}

const COUNT = new Intl.NumberFormat('en-US');

/** "1,204 in, 388 out" */
export function tokensLine(facts: Pick<TurnFacts, 'promptTokens' | 'completionTokens'>): string {
  return `${COUNT.format(facts.promptTokens)} in, ${COUNT.format(facts.completionTokens)} out`;
}

/** "3 calls, slowest 4.2 s"; "1 call, 900 ms" */
export function callsLine(facts: Pick<TurnFacts, 'calls' | 'slowestMs'>): string {
  const calls = `${facts.calls} ${facts.calls === 1 ? 'call' : 'calls'}`;
  if (facts.slowestMs === null) return calls;
  const time = facts.slowestMs < 1000 ? `${Math.round(facts.slowestMs)} ms` : `${(facts.slowestMs / 1000).toFixed(1)} s`;
  return `${calls}, ${facts.calls === 1 ? '' : 'slowest '}${time}`;
}

const FUNDING_WORDS: Record<string, string> = {
  plan_paid: 'Paid plan',
  plan_trial: 'Trial',
  plan_free: 'Free plan',
  plan_granted: 'Granted plan',
  pack: 'Message pack',
  pack_granted: 'Granted pack',
};

/** "Paid plan (Pro)", "Granted plan (Pro), sponsor Acme", or the server's word for a kind this list does not know. */
export function fundingLine(funding: AdminTurnAttribution): string {
  const base = FUNDING_WORDS[funding.kind] ?? funding.kind.replace(/_/g, ' ');
  const plan = funding.plan ? ` (${funding.plan.name})` : '';
  const sponsor = funding.sponsor ? `, sponsor ${funding.sponsor.name}` : '';
  return `${base}${plan}${sponsor}`;
}

const STATUS_WORDS: Record<string, string> = {
  active: 'active',
  trialing: 'on trial',
  past_due: 'payment overdue',
  cancelled: 'cancelled',
  expired: 'expired',
};

/** "Pro, active"; "Free" when there is no subscription; "No plan" when the server names none. */
export function planLine(owner: Pick<AdminConversationOwner, 'plan' | 'subscription_status'>): string {
  const status = owner.subscription_status ? STATUS_WORDS[owner.subscription_status] ?? owner.subscription_status : null;
  const name = owner.plan?.name ?? 'No plan';
  return status ? `${name}, ${status}` : name;
}

/** The ids of tool rows the view cut at 200 kB, whose full result has its own route. */
export function cutResults(messages: readonly AdminViewMessage[]): number[] {
  return messages
    .filter((message) => (message.metadata as { result_truncated?: unknown } | null)?.result_truncated === true)
    .map((message) => message.id);
}
