"use client"

import * as React from "react"
import {
  MessageSquarePlus,
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
    title: "Library",
    url: "#",
    icon: Library,
    items: [
      { title: "Cases", url: "/cases" },
      { title: "Notes", url: "/notes" },
      { title: "Folders", url: "/folders" },
    ],
  },
  { title: "My Requests", url: "/content-requests", icon: ClipboardList },
  { title: "Community",   url: "/shared",           icon: Users },
  { title: "Bookmarks",   url: "/bookmarks",        icon: Bookmark },
]

// Minimal nav for guest users
const navGuest = [
  { title: "Community", url: "/shared", icon: Users },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, isGuest } = useAuthStore();
  const isLawyer = user?.profile?.user_type === 'lawyer';

  // Guests see minimal navigation
  const navItems = isGuest
    ? navGuest
    : [
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
        <NavMain items={navItems} />
        {!isGuest && <NavConversations />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
