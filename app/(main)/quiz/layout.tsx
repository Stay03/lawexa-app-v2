import { QuizGuard } from '@/components/auth/QuizGuard';

/**
 * Gates the entire quiz player to its soft-launch audience (researcher / admin /
 * superadmin). Everyone else is redirected home by QuizGuard.
 */
export default function QuizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QuizGuard>{children}</QuizGuard>;
}
