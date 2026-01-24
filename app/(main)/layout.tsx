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
import { ShareButton } from "@/components/common/ShareButton"
import { ReaderModeToggle } from "@/components/cases/ReaderModeToggle"
import { usePathname } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { useBreadcrumbStore } from "@/lib/stores/breadcrumbStore"

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
  // Subscribe to overrides array to trigger re-render when it changes
  const overrides = useBreadcrumbStore((state) => state.overrides)
  const getOverrideLabel = useBreadcrumbStore((state) => state.getLabel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const breadcrumbs = React.useMemo(() => getBreadcrumbs(pathname, getOverrideLabel), [pathname, overrides])
  const [mounted, setMounted] = useState(false)

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
        <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
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
            {/* Show Share on case detail and report pages */}
            {pathname.startsWith('/cases/') && pathname.split('/').length >= 3 && (
              <ShareButton />
            )}
            {/* Show Reader Mode toggle only on case detail page (not report page) */}
            {pathname.startsWith('/cases/') && pathname.split('/').length === 3 && (
              <ReaderModeToggle />
            )}
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-x-hidden p-4 pt-0">
          {children}
        </div>
        </SidebarInset>
      </SidebarProvider>
    </OnboardingGuard>
  )
}
