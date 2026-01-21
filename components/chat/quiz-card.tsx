'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronDown,
  BookOpen,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatContext } from '@/lib/contexts/chat-context';

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

interface QuizCardProps {
  quiz: QuizInfo;
  quizNumber?: number;
  onAnswerSelect?: (quizIndex: number, answerId: string) => void;
  selectedAnswer?: string;
  showResult?: boolean;
}

export function QuizCard({
  quiz,
  quizNumber,
  onAnswerSelect,
  selectedAnswer,
  showResult = false,
}: QuizCardProps) {
  // Local state for standalone usage (when not in a list)
  const [localSelectedOption, setLocalSelectedOption] = useState<string | null>(
    null
  );

  const selectedOption = selectedAnswer ?? localSelectedOption;
  const isCorrect = selectedOption === quiz.answer;
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  // Auto-open explanation when result is shown
  const shouldShowExplanation = showResult;

  const handleOptionClick = (optionId: string) => {
    if (showResult) return;

    if (onAnswerSelect && quizNumber !== undefined) {
      onAnswerSelect(quizNumber - 1, optionId);
    } else {
      setLocalSelectedOption(optionId);
    }
  };

  const getOptionStyles = (optionId: string) => {
    const baseStyles =
      'flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all duration-200 ease-out';

    if (!showResult) {
      return cn(
        baseStyles,
        'cursor-pointer',
        selectedOption === optionId
          ? 'border-primary bg-primary/5 scale-[1.01] shadow-sm'
          : 'border-border hover:border-primary/50 hover:bg-muted/50 hover:scale-[1.005]'
      );
    }

    // After submission - show results
    if (optionId === quiz.answer) {
      return cn(baseStyles, 'border-green-500 bg-green-500/10');
    }
    if (optionId === selectedOption && optionId !== quiz.answer) {
      return cn(baseStyles, 'border-red-500 bg-red-500/10');
    }
    return cn(baseStyles, 'border-border opacity-50');
  };

  return (
    <Card
      size="sm"
      className="w-full max-w-[calc(100vw-3rem)] transition-shadow duration-300 hover:shadow-md sm:max-w-2xl"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium leading-relaxed">
            {quizNumber && (
              <span className="text-muted-foreground mr-2">Q{quizNumber}.</span>
            )}
            {quiz.question}
          </CardTitle>
          <Badge variant="outline" className="shrink-0">
            <HelpCircle className="size-3" data-icon="inline-start" />
            MCQ
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {quiz.options.map((option) => (
          <div
            key={option.id}
            onClick={() => handleOptionClick(option.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOptionClick(option.id);
              }
            }}
            className={getOptionStyles(option.id)}
            role="button"
            tabIndex={showResult ? -1 : 0}
            aria-pressed={selectedOption === option.id}
          >
            <span
              className={cn(
                'min-w-[1.5rem] shrink-0 font-semibold transition-colors duration-200',
                selectedOption === option.id && !showResult
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {option.id}.
            </span>
            <span className="flex-1">{option.text}</span>
            <div className="flex size-5 shrink-0 items-center justify-center">
              {showResult && option.id === quiz.answer && (
                <CheckCircle className="size-5 animate-in fade-in zoom-in text-green-500 duration-300" />
              )}
              {showResult &&
                option.id === selectedOption &&
                option.id !== quiz.answer && (
                  <XCircle className="size-5 animate-in fade-in zoom-in text-red-500 duration-300" />
                )}
            </div>
          </div>
        ))}
      </CardContent>

      {/* Show result badge and explanation after submission */}
      {showResult && (
        <CardFooter className="flex-col items-stretch gap-3">
          <div className="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 duration-300">
            {isCorrect ? (
              <Badge className="bg-green-500 hover:bg-green-500">
                <CheckCircle className="size-3" data-icon="inline-start" />
                Correct!
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="size-3" data-icon="inline-start" />
                Incorrect
              </Badge>
            )}
          </div>

          <Collapsible
            open={isExplanationOpen || shouldShowExplanation}
            onOpenChange={setIsExplanationOpen}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between transition-colors duration-200"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4" />
                  {isExplanationOpen || shouldShowExplanation
                    ? 'Hide Explanation'
                    : 'Show Explanation'}
                </span>
                <ChevronDown
                  className={cn(
                    'size-4 transition-transform duration-300 ease-out',
                    (isExplanationOpen || shouldShowExplanation) && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
              <div className="space-y-2 pt-3">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {quiz.explanation}
                </p>
                {quiz.source && (
                  <p className="text-muted-foreground/70 text-xs italic">
                    Source: {quiz.source}
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardFooter>
      )}
    </Card>
  );
}

interface QuizCardListProps {
  quizzes: QuizInfo[];
}

export function QuizCardList({ quizzes }: QuizCardListProps) {
  const chatContext = useChatContext();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleAnswerSelect = useCallback((quizIndex: number, answerId: string) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [quizIndex]: answerId }));
  }, [isSubmitted]);

  const allAnswered = quizzes.length > 0 && Object.keys(answers).length === quizzes.length;

  const handleSubmitAnswers = useCallback(() => {
    if (!allAnswered || !chatContext) return;

    // Format answers for sending
    const formattedAnswers = quizzes
      .map((quiz, index) => {
        const selectedId = answers[index];
        const selectedOption = quiz.options.find((opt) => opt.id === selectedId);
        return `Q${index + 1}: ${selectedId}${selectedOption ? ` - ${selectedOption.text}` : ''}`;
      })
      .join('\n');

    const message = `My Quiz Answers:\n${formattedAnswers}`;

    // Send the message
    chatContext.sendMessage(message);
    setIsSubmitted(true);
  }, [allAnswered, answers, quizzes, chatContext]);

  if (quizzes.length === 0) return null;

  // Calculate score after submission
  const score = isSubmitted
    ? quizzes.reduce((acc, quiz, index) => {
        return acc + (answers[index] === quiz.answer ? 1 : 0);
      }, 0)
    : 0;

  return (
    <div className="my-3 flex flex-col gap-4">
      {quizzes.map((quiz, index) => (
        <QuizCard
          key={`quiz-${index}`}
          quiz={quiz}
          quizNumber={index + 1}
          onAnswerSelect={handleAnswerSelect}
          selectedAnswer={answers[index]}
          showResult={isSubmitted}
        />
      ))}

      {/* Submit button or score display */}
      <div
        className={cn(
          'flex items-center justify-center transition-all duration-300',
          isSubmitted ? 'gap-4' : ''
        )}
      >
        {!isSubmitted ? (
          <Button
            onClick={handleSubmitAnswers}
            disabled={!allAnswered || !chatContext || chatContext.isStreaming}
            className="animate-in fade-in slide-in-from-bottom-2 gap-2 duration-300"
            size="lg"
          >
            <Send className="size-4" />
            Submit Answers ({Object.keys(answers).length}/{quizzes.length})
          </Button>
        ) : (
          <div className="animate-in fade-in zoom-in flex items-center gap-3 duration-300">
            <Badge
              variant="outline"
              className={cn(
                'px-4 py-2 text-base',
                score === quizzes.length
                  ? 'border-green-500 bg-green-500/10 text-green-600'
                  : score >= quizzes.length / 2
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600'
                    : 'border-red-500 bg-red-500/10 text-red-600'
              )}
            >
              Score: {score}/{quizzes.length}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
