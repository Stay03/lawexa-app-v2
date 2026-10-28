import { redirect } from 'next/navigation';

/** Admin > Feedback: the cancellation answers are its one page for now. */
export default function AdminFeedbackPage() {
  redirect('/admin/feedback/cancellations');
}
