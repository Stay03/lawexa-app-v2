'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminMessageList } from '@/components/admin';
import { useAdminConversation } from '@/lib/hooks/useAdmin';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import {
  ArrowLeft,
  Lock,
  Globe,
  MessageSquare,
  Calendar,
  Bot,
  User,
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminConversationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminConversationDetailPage({
  params,
}: AdminConversationDetailPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useAdminConversation(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  // Set breadcrumb label to conversation title
  useEffect(() => {
    if (data?.data?.title) {
      setOverride(id, data.data.title);
    }
    return () => {
      clearOverride(id);
    };
  }, [data?.data?.title, id, setOverride, clearOverride]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/conversations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Conversations
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Conversation not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const conversation = data.data;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/conversations">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>
      </Link>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">
                {conversation.title || 'Untitled Conversation'}
              </CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                ID: {conversation.id}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={
                  conversation.status === 'active' ? 'default' : 'secondary'
                }
              >
                {conversation.status}
              </Badge>
              {conversation.is_private ? (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" /> Private
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-green-600 border-green-600"
                >
                  <Globe className="h-3 w-3" /> Public
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <User className="h-3 w-3" /> User UUID
              </p>
              <p className="font-mono text-xs break-all">
                {conversation.user_uuid}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Bot className="h-3 w-3" /> Agent
              </p>
              <p>{conversation.agent?.name || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Messages
              </p>
              <p>{conversation.messages_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p>{format(new Date(conversation.created_at), 'PPp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Card */}
      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
          <CardDescription>
            {conversation.messages.length} messages in chronological order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conversation.messages.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No messages in this conversation
            </p>
          ) : (
            <AdminMessageList messages={conversation.messages} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
