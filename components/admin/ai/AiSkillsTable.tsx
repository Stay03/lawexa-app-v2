'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AdminAiSkill } from '@/types/admin-ai';
import { LOAD_MODE_LABEL } from './skill-model';

interface AiSkillsTableProps {
  skills: AdminAiSkill[];
  isLoading: boolean;
  onEdit: (skill: AdminAiSkill) => void;
  onDelete: (skill: AdminAiSkill) => void;
}

/** The skills list: one row per skill, opening its page; the same table as the tools list. */
export function AiSkillsTable({ skills, isLoading, onEdit, onDelete }: AiSkillsTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-full max-w-[800px]" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">No skills found</div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Skill</TableHead>
            <TableHead className="w-[120px] font-semibold">Load mode</TableHead>
            <TableHead className="w-[90px] font-semibold">Status</TableHead>
            <TableHead className="w-[70px] text-right font-semibold">Version</TableHead>
            <TableHead className="w-[70px] text-right font-semibold">Agents</TableHead>
            <TableHead className="w-[100px] text-right font-semibold">Loads (7d)</TableHead>
            <TableHead className="w-[130px] font-semibold">Updated</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.map((skill, index) => (
            <TableRow
              key={skill.id}
              className={cn('cursor-pointer transition-colors', index % 2 === 1 && 'bg-muted/20')}
              onClick={() => router.push(`/admin/ai/skills/${skill.id}`)}
            >
              <TableCell className="max-w-[320px]">
                <span className="block truncate font-medium">{skill.display_name}</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">{skill.name}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{LOAD_MODE_LABEL[skill.load_mode]}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={skill.is_active ? 'default' : 'secondary'}>
                  {skill.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">v{skill.version}</TableCell>
              <TableCell className="text-right tabular-nums">{skill.agents_count}</TableCell>
              <TableCell className="text-right tabular-nums">{skill.loads_7d.toLocaleString('en-US')}</TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(skill.updated_at), { addSuffix: true })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(skill.updated_at), 'PPpp')}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Actions for ${skill.display_name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(skill);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(skill);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
