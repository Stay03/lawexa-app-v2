'use client';

import { useGreeting } from '@/lib/hooks/useGreeting';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scale, FileText, Bookmark, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const quickLinks = [
  {
    title: 'Browse Cases',
    description: 'Search and explore Nigerian law cases',
    icon: Scale,
    href: '/cases',
  },
  {
    title: 'Read Notes',
    description: 'Access legal notes and study materials',
    icon: FileText,
    href: '/notes',
  },
  {
    title: 'Bookmarks',
    description: 'View your saved cases and notes',
    icon: Bookmark,
    href: '/bookmarks',
  },
];

export default function HomePage() {
  const greeting = useGreeting();
  const { isAuthenticated, isGuest } = useAuthStore();

  return (
    <div className="space-y-8">
      {/* Greeting section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
        <p className="mt-2 text-muted-foreground">
          {isAuthenticated && !isGuest
            ? 'Welcome back to Lawexa. What would you like to explore today?'
            : 'Welcome to Lawexa. Start exploring Nigerian legal resources.'}
        </p>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Card key={link.href} className="group transition-colors hover:border-primary/50">
            <CardHeader className="pb-3">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <link.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{link.title}</CardTitle>
              <CardDescription>{link.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="ghost" className="group-hover:text-primary">
                <Link href={link.href}>
                  Explore
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Guest CTA */}
      {(!isAuthenticated || isGuest) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Create a free account</CardTitle>
            <CardDescription>
              Sign up to save bookmarks, track your reading history, and access premium content.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
