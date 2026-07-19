'use client';

import { Bot, ListChecks, ArrowRight } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ExecutionPlanInfo } from '@/lib/utils/parse-content-xml';

interface ExecutionPlanCardProps {
  plan: ExecutionPlanInfo;
}

export function ExecutionPlanCard({ plan }: ExecutionPlanCardProps) {
  // Multi-question variant
  if (plan.totalQuestions && plan.questions && plan.questions.length > 0) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <ListChecks className="size-4 text-primary" />
            Execution Plan
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              {plan.totalQuestions} questions
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-1">
          {plan.questions.map((q) => (
            <div
              key={q.index}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-input/30 text-[11px] font-medium tabular-nums">
                {q.index}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{q.summary}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {q.classification && (
                    <span className="text-[10px] text-muted-foreground">{q.classification}</span>
                  )}
                  {q.pipeline && (
                    <>
                      <span className="text-muted-foreground text-[10px]">&middot;</span>
                      <span className="text-[10px] text-muted-foreground">{q.pipeline}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Single-question agent routing variant
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Bot className="size-4 text-primary" />
          Execution Plan
          {plan.classification && (
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              {plan.classification}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {plan.querySummary && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">{plan.querySummary}</p>
          </div>
        )}

        {plan.agents && plan.agents.length > 0 && (
          <div className="space-y-1">
            {plan.agents.map((agent) => (
              <div
                key={agent.order}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
              >
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ArrowRight className="size-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{agent.name}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                    {agent.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {plan.writerNeeded && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
            <Bot className="size-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Writer Agent will draft the final output</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
