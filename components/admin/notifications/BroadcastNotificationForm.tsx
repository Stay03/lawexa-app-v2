'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { useBroadcastNotification } from '@/lib/hooks/useAdminNotifications';
import {
  broadcastNotificationSchema,
  type BroadcastNotificationFormValues,
} from '@/lib/validations/notifications';
import { extractApiError } from '@/lib/utils/api-error';
import type { BroadcastNotificationData } from '@/types/notification';

/******************************************************************************
                                Component
******************************************************************************/

/**
 * Default component. Form to compose and broadcast a notification.
 */
function BroadcastNotificationForm() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const broadcastMutation = useBroadcastNotification();

  const form = useForm<BroadcastNotificationFormValues>({
    resolver: zodResolver(broadcastNotificationSchema),
    defaultValues: {
      title: '',
      message: '',
      action_url: '',
      icon: '',
      targeting: 'all',
      role: undefined,
      user_ids: '',
    },
  });

  const targeting = form.watch('targeting');

  // Build the API payload from form values
  const buildPayload = useCallback(
    (data: BroadcastNotificationFormValues): BroadcastNotificationData => {
      const payload: BroadcastNotificationData = {
        title: data.title,
        message: data.message,
      };
      // Optional fields
      if (data.action_url) payload.action_url = data.action_url;
      if (data.icon) payload.icon = data.icon;
      // Targeting
      if (data.targeting === 'all') {
        payload.broadcast_to_all = true;
      } else if (data.targeting === 'role' && data.role) {
        payload.role = data.role;
      } else if (data.targeting === 'user_ids' && data.user_ids) {
        payload.user_ids = data.user_ids
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id));
      }
      return payload;
    },
    []
  );

  // Show confirmation dialog before sending
  const handleFormSubmit = useCallback(
    (data: BroadcastNotificationFormValues) => {
      setConfirmOpen(true);
    },
    []
  );

  // Actually send the broadcast
  const handleConfirmSend = useCallback(async () => {
    const data = form.getValues();
    const payload = buildPayload(data);

    try {
      const response = await broadcastMutation.mutateAsync(payload);
      toast.success(
        `Notification sent to ${response.data.recipients_count} user(s)`
      );
      setConfirmOpen(false);
      form.reset();
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error(apiError.message || 'Failed to broadcast notification');
      setConfirmOpen(false);
    }
  }, [form, buildPayload, broadcastMutation]);

  // Targeting description for confirmation
  const targetingLabel = targeting === 'all'
    ? 'all users'
    : targeting === 'role'
      ? `all ${form.watch('role') || '...'} users`
      : 'specific users';

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="space-y-6 max-w-2xl"
        >
          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Notification title"
                    maxLength={255}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Keep under 50 characters for mobile display.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Message */}
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Notification message body"
                    className="min-h-[100px] resize-none"
                    maxLength={2000}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {field.value.length}/2000 characters
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Action URL */}
          <FormField
            control={form.control}
            name="action_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action URL (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://example.com/page"
                    type="url"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Users can click through to this URL from the notification.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Icon */}
          <FormField
            control={form.control}
            name="icon"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. warning, star, info"
                    maxLength={50}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Icon identifier for the notification display.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Targeting */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Target Audience</Label>
            <FormField
              control={form.control}
              name="targeting"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select targeting" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All users</SelectItem>
                        <SelectItem value="role">By role</SelectItem>
                        <SelectItem value="user_ids">Specific users</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role selector (visible when targeting=role) */}
            {targeting === 'role' && (
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="researcher">Researcher</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="superadmin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* User IDs input (visible when targeting=user_ids) */}
            {targeting === 'user_ids' && (
              <FormField
                control={form.control}
                name="user_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User IDs</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 1, 2, 3"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of user IDs.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={broadcastMutation.isPending}
          >
            <Send className="mr-2 h-4 w-4" />
            Send Notification
          </Button>
        </form>
      </Form>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Broadcast</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send a notification to <strong>{targetingLabel}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Preview */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
            <p className="text-sm font-semibold">{form.watch('title') || 'Untitled'}</p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {form.watch('message') || 'No message'}
            </p>
          </div>

          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={broadcastMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={broadcastMutation.isPending}
            >
              {broadcastMutation.isPending ? 'Sending...' : 'Confirm & Send'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/******************************************************************************
                                Export default
******************************************************************************/

export default BroadcastNotificationForm;
export { BroadcastNotificationForm };
