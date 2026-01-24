'use client';

import { cn } from '@/lib/utils';
import { CheckCircle, XCircle } from 'lucide-react';
import type { ToolMessage } from '@/types/chat';
import { extractToolDisplayData } from '@/lib/utils/tool-display';

interface ToolCallDetailsProps {
  message: ToolMessage;
  className?: string;
}

export function ToolCallDetails({ message, className }: ToolCallDetailsProps) {
  const displayData = extractToolDisplayData(message);

  return (
    <div className={cn('space-y-3 pt-2', className)}>
      {/* Parameters */}
      {displayData.parameters.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Parameters
          </p>
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

      {/* Result Summary */}
      {message.toolStatus === 'complete' && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Result
          </p>
          <div className="flex items-center gap-2">
            {displayData.success ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400">
                  {displayData.resultSummary || 'Completed successfully'}
                </span>
              </>
            ) : (
              <>
                <XCircle className="text-destructive h-3.5 w-3.5" />
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
