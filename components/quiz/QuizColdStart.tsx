import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuizMessage } from './QuizMessage';

/** Shown when the question bank is empty (cold start) — not an error. */
export function QuizColdStart() {
  return (
    <QuizMessage
      icon={<Sparkles className="h-7 w-7" />}
      title="Your question bank is warming up"
      description="We turn your study conversations into practice questions overnight. Check back soon — there's nothing to answer just yet."
      action={
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      }
    />
  );
}
