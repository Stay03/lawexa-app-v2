"use client"

import * as React from "react"
import {
  Scale,
  FileText,
  Bookmark,
  LayoutDashboard,
  Settings,
  Users,
  Home,
  HelpCircle,
  LifeBuoy,
  Send,
} from "lucide-react"

import { NavMain } from "@/components/layout/nav-main"
import { NavSecondary } from "@/components/layout/nav-secondary"
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
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Cases",
    url: "/cases",
    icon: Scale,
    items: [
      { title: "Browse All", url: "/cases" },
      { title: "Supreme Court", url: "/cases?court=supreme" },
      { title: "Court of Appeal", url: "/cases?court=appeal" },
      { title: "High Court", url: "/cases?court=high" },
    ],
  },
  {
    title: "Notes",
    url: "/notes",
    icon: FileText,
    items: [
      { title: "Browse All", url: "/notes" },
      { title: "My Notes", url: "/notes/mine" },
      { title: "Create Note", url: "/notes/create" },
    ],
  },
  {
    title: "Bookmarks",
    url: "/bookmarks",
    icon: Bookmark,
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
]

const navAdmin = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    items: [
      { title: "General", url: "/settings/general" },
      { title: "Account", url: "/settings/account" },
      { title: "Privacy", url: "/settings/privacy" },
      { title: "Billing", url: "/settings/billing" },
    ],
  },
  {
    title: "Admin",
    url: "/admin",
    icon: Users,
    items: [
      { title: "Dashboard", url: "/admin" },
      { title: "Users", url: "/admin/users" },
      { title: "Content", url: "/admin/content" },
      { title: "Analytics", url: "/admin/analytics" },
    ],
  },
]

const navSecondary = [
  {
    title: "Support",
    url: "/support",
    icon: LifeBuoy,
  },
  {
    title: "Feedback",
    url: "/feedback",
    icon: Send,
  },
  {
    title: "Help",
    url: "/help",
    icon: HelpCircle,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin" || user?.role === "superadmin"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="group-data-[collapsible=icon]:hidden">
              <Link href="/">
                <Image
                  src="/logo.png"
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
      <SidebarContent>
        <NavMain items={navMain} />
        {isAdmin && <NavMain items={navAdmin} />}
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
