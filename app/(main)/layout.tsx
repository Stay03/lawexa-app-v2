'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from "@/components/layout/app-sidebar"
import { OnboardingGuard } from "@/components/auth/OnboardingGuard"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { UpgradePill } from "@/components/common/UpgradePill"
import { NotificationBell } from "@/components/notifications"
import { ShareButton } from "@/components/common/ShareButton"
import { ReaderModeToggle } from "@/components/cases/ReaderModeToggle"
import { ConversationShareHeaderButton } from "@/components/conversations"
import { ConfidentialModeToggle } from "@/components/common/ConfidentialModeToggle"
import { usePathname } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { useBreadcrumbStore } from "@/lib/stores/breadcrumbStore"
import { useAuthStore } from "@/lib/stores/authStore"
import { useGuestAuth } from "@/lib/hooks/useGuestAuth"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { InstallAppCard } from "@/components/pwa/InstallAppCard"

function getBreadcrumbs(pathname: string, getOverrideLabel: (segment: string) => string | undefined) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return [{ label: 'Home', href: '/', isPage: true }]
  }

  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const isPage = index === segments.length - 1

    // Check for override label first
    const overrideLabel = getOverrideLabel(segment)
    if (overrideLabel) {
      return { label: overrideLabel, href, isPage }
    }

    // Special case for conversation routes: /c/[id] -> "Conversation"
    if (segment === 'c') {
      return { label: 'Conversation', href, isPage }
    }

    // Default: capitalize and replace hyphens
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
    return { label, href, isPage }
  })
}

function LayoutSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r bg-sidebar p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
      {/* Main content - matches real layout structure */}
      <div className="flex-1 flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-4 w-32" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname()
  const isGuest = useAuthStore((state) => state.isGuest)
  // Subscribe to overrides array to trigger re-render when it changes
  const overrides = useBreadcrumbStore((state) => state.overrides)
  const getOverrideLabel = useBreadcrumbStore((state) => state.getLabel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const breadcrumbs = React.useMemo(() => getBreadcrumbs(pathname, getOverrideLabel), [pathname, overrides])
  const [mounted, setMounted] = useState(false)
  const isMobile = useIsMobile()
  useGuestAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show skeleton during SSR and initial hydration to avoid Radix ID mismatch
  if (!mounted) {
    return <LayoutSkeleton>{children}</LayoutSkeleton>
  }

  return (
    <OnboardingGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="max-h-svh overflow-hidden">
        <header className="relative flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="pointer-events-auto">
              <UpgradePill />
            </div>
          </div>
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                    <BreadcrumbItem className={index === 0 ? '' : 'hidden md:block'}>
                      {crumb.isPage ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.href}>
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2 px-4">
            {(() => {
              const shareNode = pathname.startsWith('/cases/') && pathname.split('/').length >= 3
                ? <ShareButton />
                : null;
              const readerModeNode = pathname.startsWith('/cases/') && pathname.split('/').length === 3
                ? <ReaderModeToggle />
                : null;
              const conversationShareNode = pathname.startsWith('/c/') && !isGuest
                ? <ConversationShareHeaderButton />
                : null;

              const confidentialNode = !isGuest ? <ConfidentialModeToggle /> : null;

              if (isMobile) {
                return (
                  <>
                    {confidentialNode}
                    {!isGuest && <NotificationBell />}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="flex w-auto flex-col gap-1 p-1">
                        {shareNode}
                        {readerModeNode}
                        {conversationShareNode}
                        <ThemeToggle />
                      </PopoverContent>
                    </Popover>
                  </>
                );
              }

              return (
                <>
                  {shareNode}
                  {readerModeNode}
                  {conversationShareNode}
                  {confidentialNode}
                  {!isGuest && <NotificationBell />}
                  <ThemeToggle />
                </>
              );
            })()}
          </div>
        </header>
        <div
          className={cn(
            "flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto min-h-0 p-4 pt-0",
            // Chat manages its own horizontal breathing room (ChatContainerContent
            // has px-4); drop the layout's outer px on mobile so the message
            // column reclaims the gutter.
            pathname.startsWith('/c/') && "max-md:px-0"
          )}
        >
          {children}
        </div>
        <InstallAppCard />
        </SidebarInset>
      </SidebarProvider>
    </OnboardingGuard>
  )
}
