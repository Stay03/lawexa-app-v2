'use client';

import { Monitor, BookOpen } from 'lucide-react';
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

export default function AppearanceSettingsPage() {
  const { isReaderModeEnabled, toggleReaderMode } = useReaderMode();

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
      </CardContent>
    </Card>
  );
}
