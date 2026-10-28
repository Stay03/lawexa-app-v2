'use client';

import Link from 'next/link';
import { BookOpenCheck } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AdminAiAgentSkill } from '@/types/admin-ai';
import { LOAD_MODE_LABEL } from './skill-model';

/**
 * The skills on an agent, read-only, so an admin sees from either side what
 * Lawexa is given (a1f45096). Skills are attached and detached on the
 * skill's own page. Nothing is drawn for a server that sends no `skills`.
 */
export function AiAgentSkillsCard({ skills }: { skills: AdminAiAgentSkill[] | undefined }) {
  if (!skills) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4" />
          Skills ({skills.length})
        </CardTitle>
        <CardDescription>Attach or detach a skill from its page in Skills.</CardDescription>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No skills on this agent.{' '}
            <Link href="/admin/ai/skills" className="text-primary hover:underline">
              Open Skills
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {skills.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <Link href={`/admin/ai/skills/${skill.id}`} className="block truncate font-medium text-primary hover:underline">
                    {skill.display_name}
                  </Link>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{skill.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {skill.is_active ? null : <Badge variant="secondary">Inactive</Badge>}
                  <Badge variant="outline">{LOAD_MODE_LABEL[skill.load_mode]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
