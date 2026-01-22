"use client"

import * as React from "react"
import {
  Scale,
  FileText,
  MessageSquarePlus,
  Library,
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
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
      <SidebarContent className="flex flex-col gap-0">
        <NavMain items={navMain} />
        <NavConversations />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
