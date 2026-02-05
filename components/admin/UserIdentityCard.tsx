'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Shield,
  Calendar,
  Copy,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import type { AdminUserDetail } from '@/types/admin';
import { cn } from '@/lib/utils';

interface UserIdentityCardProps {
  user: AdminUserDetail;
  className?: string;
}

export function UserIdentityCard({ user, className }: UserIdentityCardProps) {
  const [copied, setCopied] = useState(false);

  // Generate initials from name or email
  const getInitials = (): string => {
    if (user.name) {
      const parts = user.name.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0]?.slice(0, 2).toUpperCase() || '??';
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  const handleCopyUuid = async () => {
    await navigator.clipboard.writeText(user.uuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedUuid = `${user.uuid.slice(0, 8)}...${user.uuid.slice(-4)}`;

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
        {/* Avatar */}
        <Avatar className="h-20 w-20">
          {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name || 'User'} />}
          <AvatarFallback className="text-2xl font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>

        {/* Name/Email */}
        <div className="space-y-1">
          {user.name ? (
            <>
              <h2 className="font-semibold text-lg">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </>
          ) : (
            <h2 className="font-semibold text-lg">{user.email}</h2>
          )}
        </div>

        {/* UUID with copy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleCopyUuid}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{truncatedUuid}</span>
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-mono text-xs">{user.uuid}</p>
            <p className="text-muted-foreground mt-1">Click to copy</p>
          </TooltipContent>
        </Tooltip>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge
            variant={
              user.role === 'admin' || user.role === 'superadmin'
                ? 'default'
                : 'secondary'
            }
          >
            {user.role}
          </Badge>
          {user.is_verified ? (
            <Badge
              variant="outline"
              className="gap-1 text-green-600 border-green-600"
            >
              <CheckCircle2 className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 text-amber-600 border-amber-600"
            >
              <XCircle className="h-3 w-3" /> Unverified
            </Badge>
          )}
          {user.is_creator && (
            <Badge variant="outline" className="gap-1">
              Creator
            </Badge>
          )}
        </div>

        <Separator />

        {/* Metadata */}
        <div className="w-full space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Auth Provider
            </span>
            <span className="capitalize font-medium">{user.auth_provider}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Member Since
            </span>
            <span className="font-medium">
              {format(new Date(user.created_at), 'PP')}
            </span>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <Link href={`/admin/users/${user.uuid}/conversations`} className="w-full">
          <Button className="w-full">
            <MessageSquare className="mr-2 h-4 w-4" />
            View Conversations
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
