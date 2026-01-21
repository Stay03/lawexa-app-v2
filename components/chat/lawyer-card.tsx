'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, LinkedinIcon, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export interface LawyerInfo {
  name: string;
  email: string;
  location: string;
  lawSchool: string;
  firmName: string;
  firmLogoUrl: string;
  /** Lawyer's profile photo URL (optional, to be provided by backend) */
  avatarUrl?: string;
  /** Lawyer's LinkedIn profile URL (optional) */
  linkedinUrl?: string;
  /** Lawyer's practice areas (optional) */
  practiceArea?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getFirstName(name: string): string {
  return name.split(' ')[0] || name;
}

function handleConnect(lawyerName: string) {
  const toastId = toast.loading('Connecting...');

  setTimeout(() => {
    toast.success(
      `Lawexa has contacted ${lawyerName} on your behalf. You'll receive a call or email from them soon.`,
      { id: toastId, duration: 5000 }
    );
  }, 3000);
}

export function LawyerCard({ lawyer }: { lawyer: LawyerInfo }) {
  const hasFirm = lawyer.firmName && lawyer.firmName.trim() !== '';
  const hasLocation = lawyer.location && lawyer.location.trim() !== '';
  const hasFirmLogo = lawyer.firmLogoUrl && lawyer.firmLogoUrl.trim() !== '';
  const hasAvatar = lawyer.avatarUrl && lawyer.avatarUrl.trim() !== '';
  const hasLinkedin = lawyer.linkedinUrl && lawyer.linkedinUrl.trim() !== '';
  const hasPracticeArea =
    lawyer.practiceArea && lawyer.practiceArea.trim() !== '';

  return (
    <Card size="sm" className="w-full max-w-[calc(100vw-3rem)] sm:max-w-sm">
      <CardContent className="flex items-start gap-3">
        {/* Lawyer avatar - shows photo if available, otherwise initials */}
        <Avatar size="lg" className="overflow-hidden">
          {hasAvatar && (
            <AvatarImage
              src={lawyer.avatarUrl}
              alt={lawyer.name}
              className="object-cover"
            />
          )}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {getInitials(lawyer.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-foreground truncate">
              {lawyer.name}
            </h4>
            {/* Firm logo positioned top-right */}
            {hasFirmLogo && (
              <img
                src={lawyer.firmLogoUrl}
                alt={lawyer.firmName}
                className="h-8 w-auto max-w-[100px] object-contain shrink-0 !m-0"
              />
            )}
          </div>

          {hasFirm && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate">{lawyer.firmName}</span>
            </div>
          )}

          {hasLocation && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{lawyer.location}</span>
            </div>
          )}

          {hasPracticeArea && (
            <div className="flex items-start gap-1.5 text-muted-foreground text-xs">
              <Briefcase className="size-3 shrink-0" />
              <span className="line-clamp-2">{lawyer.practiceArea}</span>
            </div>
          )}

          {hasLinkedin && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <LinkedinIcon className="size-3 shrink-0" />
              <a
                href={lawyer.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
              >
                LinkedIn Profile
              </a>
            </div>
          )}

          <Button
            size="xs"
            className="mt-2"
            onClick={() => handleConnect(lawyer.name)}
          >
            Connect with {getFirstName(lawyer.name)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LawyerCardList({ lawyers }: { lawyers: LawyerInfo[] }) {
  if (lawyers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 my-3">
      {lawyers.map((lawyer, index) => (
        <LawyerCard key={`${lawyer.email}-${index}`} lawyer={lawyer} />
      ))}
    </div>
  );
}
