'use client';

import { useRef } from 'react';
import { Camera, Trash2, User as UserIcon } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUploadAvatar, useDeleteAvatar } from '@/lib/hooks/useProfile';
import type { User } from '@/types/auth';

interface ProfileOverviewCardProps {
  user: User;
}

export function ProfileOverviewCard({ user }: ProfileOverviewCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    uploadAvatar.mutate(file);
    e.target.value = '';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Profile Overview
        </CardTitle>
        <CardDescription>Your professional profile information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="relative group">
            <Avatar className="h-24 w-24 rounded-lg">
              <AvatarImage
                src={user.avatar_url || undefined}
                alt={user.name}
              />
              <AvatarFallback className="rounded-lg text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              disabled={uploadAvatar.isPending}
            >
              <Camera className="h-5 w-5 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1">
            <h3 className="text-lg font-semibold">{user.name}</h3>
            {user.email && (
              <p className="text-sm text-muted-foreground">{user.email}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
              {user.profile?.user_type && (
                <Badge variant="outline" className="capitalize">
                  {user.profile.user_type.replace(/_/g, ' ')}
                </Badge>
              )}
              {user.profile?.profession && (
                <Badge variant="secondary" className="capitalize">
                  {user.profile.profession.replace(/_/g, ' ')}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Member since {memberSince}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatar.isPending}
            >
              {uploadAvatar.isPending ? 'Uploading...' : 'Change avatar'}
            </Button>
            {user.avatar_url && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => deleteAvatar.mutate()}
                disabled={deleteAvatar.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
