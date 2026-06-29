'use client';

import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCircle2 } from 'lucide-react';
import type { AdminUserDetail } from '@/types/admin';

interface AdminUserProfilePanelProps {
  user: AdminUserDetail;
}

function safeDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, 'PP');
}

/** Full, dense profile view for the Profile & attribution tab. Surfaces the
 *  profile fields the old sidebar card dropped, in a scannable 2-column grid. */
export function AdminUserProfilePanel({ user }: AdminUserProfilePanelProps) {
  const p = user.profile;
  const location = [p?.city, p?.state, p?.country].filter(Boolean).join(', ');

  const fields: { label: string; value: string | number }[] = [
    { label: 'Auth provider', value: user.auth_provider },
    { label: 'Member since', value: format(new Date(user.created_at), 'PP') },
    ...(p
      ? ([
          ['Profession', p.profession],
          ['Level', p.level],
          ['Area of study', p.area_of_study],
          ['University', p.university],
          ['Law school', p.law_school],
          ['Call to bar year', p.call_to_bar_year],
          ['Call number', p.call_number],
          ['Gender', p.gender],
          ['Date of birth', safeDate(p.date_of_birth)],
          ['Location', location || null],
          ['Address', p.address],
        ] as const)
          .filter(([, value]) => value != null && value !== '')
          .map(([label, value]) => ({ label, value: value as string | number }))
      : []),
  ];

  const expertise = user.areas_of_expertise;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCircle2 className="h-4 w-4" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-1 gap-x-3 gap-y-3.5 text-sm sm:grid-cols-2 sm:gap-x-6">
          {fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 font-medium capitalize">{f.value}</dd>
            </div>
          ))}
        </dl>

        {expertise.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Areas of expertise
            </p>
            <div className="flex flex-wrap gap-2">
              {expertise.map((area) => (
                <Badge key={area.id} variant="secondary">
                  {area.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {p?.bio && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Bio</p>
            <p className="text-sm leading-relaxed text-foreground/90">{p.bio}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
