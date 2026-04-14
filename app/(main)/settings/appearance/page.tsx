'use client';

import { Monitor, BookOpen, MessageSquareText } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useReaderMode } from '@/lib/hooks/useReaderMode';
import { useNarrationPrefsStore } from '@/lib/stores/narrationPrefsStore';

export default function AppearanceSettingsPage() {
  const { isReaderModeEnabled, toggleReaderMode } = useReaderMode();
  const narrationMode = useNarrationPrefsStore((s) => s.narrationMode);
  const setNarrationMode = useNarrationPrefsStore((s) => s.setNarrationMode);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Display Preferences
        </CardTitle>
        <CardDescription>
          Customize how content is displayed across the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="reader-mode" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Reader Mode
            </Label>
            <p className="text-sm text-muted-foreground">
              Display case documents with a clean, print-style white background
              for easier reading.
            </p>
          </div>
          <Switch
            id="reader-mode"
            checked={isReaderModeEnabled}
            onCheckedChange={toggleReaderMode}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="narration-mode" className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" />
              Show All Agent Activity
            </Label>
            <p className="text-sm text-muted-foreground">
              Show sub-agent commentary in the loading indicator during
              research. When off, only the main orchestrator&apos;s narration is shown.
            </p>
          </div>
          <Switch
            id="narration-mode"
            checked={narrationMode === 'all'}
            onCheckedChange={(checked) =>
              setNarrationMode(checked ? 'all' : 'orchestrator')
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
