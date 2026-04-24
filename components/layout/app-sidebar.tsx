"use client"

import * as React from "react"
import { useState } from "react"
import {
  MessageSquarePlus,
  MessageSquare,
  Library,
  Bookmark,
  ShieldCheck,
  ClipboardList,
  Users,
} from "lucide-react"

import { NavMain } from "@/components/layout/nav-main"
import { NavConversations } from "@/components/layout/nav-conversations"
import { NavUser } from "@/components/layout/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useAuthStore } from "@/lib/stores/authStore"
import { AuthModal } from "@/components/auth/AuthModal"
import Link from "next/link"
import Image from "next/image"

// Navigation data for Lawexa
const navMain = [
  {
    title: "New Chat",
    url: "/",
    icon: MessageSquarePlus,
  },
  {
    title: "Conversations",
    url: "/conversations",
    icon: MessageSquare,
  },
  {
    title: "Library",
    url: "#",
    icon: Library,
    items: [
      { title: "Cases", url: "/cases" },
      { title: "Notes", url: "/notes" },
      { title: "Statutes", url: "/statutes" },
      { title: "Folders", url: "/folders" },
      { title: "Files", url: "/files" },
    ],
  },
  { title: "My Requests", url: "/content-requests", icon: ClipboardList },
  { title: "Community",   url: "/shared",           icon: Users },
  { title: "Bookmarks",   url: "/bookmarks",        icon: Bookmark },
]

// URLs that guests cannot access — clicking opens AuthModal instead.
// Content pages (/cases, /notes, /statutes, /conversations) are guest-readable;
// the API client handles 401s if a specific request requires auth.
const GUEST_RESTRICTED_URLS = new Set([
  '/folders',
  '/files',
  '/content-requests',
  '/bookmarks',
])

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, isGuest } = useAuthStore();
  const isLawyer = user?.profile?.user_type === 'lawyer';
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const navItems = [
    ...navMain,
    ...(isLawyer
      ? [
          {
            title: 'Verification',
            url: '/lawyer-verification',
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="group-data-[collapsible=icon]:hidden">
              <Link href="/">
                <Image
                  src="/images/logo.png"
                  alt="Lawexa"
                  width={140}
                  height={32}
                  priority
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-0">
        <NavMain
          items={navItems}
          guestRestrictedUrls={isGuest ? GUEST_RESTRICTED_URLS : undefined}
          onGuestClick={isGuest ? () => setAuthModalOpen(true) : undefined}
        />
        {!isGuest && <NavConversations />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
      {isGuest && (
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      )}
    </Sidebar>
  )
}
