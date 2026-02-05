'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { AdminUserProfile, AdminAreaOfExpertise } from '@/types/admin';

interface UserProfileCardProps {
  profile: AdminUserProfile | null;
  areasOfExpertise: AdminAreaOfExpertise[];
}

interface ProfileItemProps {
  label: string;
  value: string | null | undefined;
  capitalize?: boolean;
}

function ProfileItem({ label, value, capitalize = false }: ProfileItemProps) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-sm text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-sm font-medium text-right ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

export function UserProfileCard({
  profile,
  areasOfExpertise,
}: UserProfileCardProps) {
  // Determine which sections have data
  const hasProfessional = profile?.profession || profile?.level;
  const hasEducation = profile?.university || profile?.area_of_study;
  const hasLocation = profile?.city || profile?.country;
  const hasExpertise = areasOfExpertise.length > 0;

  // Build location string
  const locationString = [profile?.city, profile?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Professional Section */}
          {hasProfessional && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Professional
              </h4>
              <dl className="space-y-2">
                <ProfileItem
                  label="Profession"
                  value={profile?.profession}
                  capitalize
                />
                <ProfileItem label="Level" value={profile?.level} />
              </dl>
            </div>
          )}

          {/* Education Section */}
          {hasEducation && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Education
              </h4>
              <dl className="space-y-2">
                <ProfileItem label="University" value={profile?.university} />
                <ProfileItem
                  label="Area of Study"
                  value={profile?.area_of_study}
                  capitalize
                />
              </dl>
            </div>
          )}

          {/* Location Section */}
          {hasLocation && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Location
              </h4>
              <dl className="space-y-2">
                <ProfileItem label="Location" value={locationString} />
              </dl>
            </div>
          )}
        </div>

        {/* Areas of Expertise */}
        {hasExpertise && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Areas of Expertise
              </h4>
              <div className="flex flex-wrap gap-2">
                {areasOfExpertise.map((area) => (
                  <Badge key={area.id} variant="secondary">
                    {area.name}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
