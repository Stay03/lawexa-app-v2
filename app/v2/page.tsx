import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SwitchBackButton } from './switch-back-button';
import { UI_COOKIE, V2_COOKIE_VALUE } from '@/v2/cookie';

export default async function V2HomePage() {
  // cookies() is async in Next 16.
  const cookieStore = await cookies();
  const isPreviewOn = cookieStore.get(UI_COOKIE)?.value === V2_COOKIE_VALUE;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Lawexa v2 preview — walking skeleton</CardTitle>
          <CardDescription>
            {/* V2-WALKING-SKELETON — literal marker for curl verification. */}
            V2-WALKING-SKELETON. This is the placeholder home for the in-progress
            v2 experience. There are no real v2 screens yet — every other route
            still falls through to the current app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The <code className="font-mono text-foreground">lawexa-ui</code>{' '}
            cookie is currently{' '}
            <span className="font-medium text-foreground">
              {isPreviewOn ? 'set to "v2" (preview on)' : 'unset (preview off)'}
            </span>
            .
          </p>
          <p>
            Manage this preview from{' '}
            <Link
              href="/settings/developer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Settings → Developer
            </Link>
            .
          </p>
          <SwitchBackButton />
        </CardContent>
      </Card>
    </main>
  );
}
