'use client';

import { cn } from '@/lib/utils';
import { Check, XCircle } from 'lucide-react';
import type { ToolMessage } from '@/types/chat';
import { extractToolDisplayData } from '@/lib/utils/tool-display';

/**
 * ToolCallDetails — the parameters + result summary inside an expanded tool step,
 * RESKINNED for the module design language (fix round §A7-41): the section labels
 * drop the templated `uppercase tracking-wide` treatment for sentence case, and the
 * success row swaps the green-500 check for the quiet monochrome marker language
 * (a muted `Check`) — failure keeps the `destructive` tint. Same data (via
 * `extractToolDisplayData`), same structure.
 */
interface ToolCallDetailsProps {
  message: ToolMessage;
  className?: string;
}

export function ToolCallDetails({ message, className }: ToolCallDetailsProps) {
  const displayData = extractToolDisplayData(message);

  return (
    <div className={cn('space-y-3 pt-2', className)}>
      {displayData.parameters.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium">Parameters</p>
          <div className="flex flex-wrap gap-2">
            {displayData.parameters.map((param, idx) => (
              <div
                key={idx}
                className="bg-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1"
              >
                <span className="text-muted-foreground text-xs">{param.label}:</span>
                <span className="text-foreground text-xs font-medium">{param.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {message.toolStatus === 'complete' && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium">Result</p>
          <div className="flex items-center gap-2">
            {displayData.success ? (
              <>
                <Check className="text-muted-foreground h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                <span className="text-muted-foreground text-xs">
                  {displayData.resultSummary || 'Completed successfully'}
                </span>
              </>
            ) : (
              <>
                <XCircle className="text-destructive h-3.5 w-3.5 shrink-0" />
                <span className="text-destructive text-xs">
                  {displayData.error || 'Failed'}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
