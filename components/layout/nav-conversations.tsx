"use client"

import { useEffect, useState } from "react"
import { stripPastedTags } from "@/lib/utils"
import { MessageSquare } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { chatApi } from "@/lib/api/chat"
import { useAuthStore } from "@/lib/stores/authStore"
import type { ConversationListItem } from "@/types/chat"

export function NavConversations() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pathname = usePathname()
  const { token } = useAuthStore()
  const { setOpenMobile } = useSidebar()

  useEffect(() => {
    const fetchConversations = async () => {
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const response = await chatApi.listConversations({
          per_page: 15,
          status: 'active',
          sort_by: 'updated_at',
          sort_order: 'desc',
        })
        setConversations(response.data)
      } catch (err) {
        console.error('Failed to fetch conversations:', err)
        setError('Failed to load conversations')
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [token])

  if (!token) {
    return null
  }

  return (
    <SidebarGroup className="flex-1 overflow-hidden">
      <SidebarGroupLabel>Recent Conversations</SidebarGroupLabel>
      <div className="flex-1 overflow-y-auto">
        <SidebarMenu>
          {isLoading ? (
            <>
              {[1, 0.8, 0.5, 0.25, 0.1].map((opacity, i) => (
                <SidebarMenuItem key={i}>
                  <div className="flex items-center gap-2 px-2 py-1.5" style={{ opacity }}>
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                  </div>
                </SidebarMenuItem>
              ))}
            </>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {error}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            conversations.map((conversation) => {
              const isActive = pathname === `/c/${conversation.id}`
              return (
                <SidebarMenuItem key={conversation.id}>
                  <SidebarMenuButton
                    asChild
                    tooltip={stripPastedTags(conversation.title)}
                    isActive={isActive}
                  >
                    <Link href={`/c/${conversation.id}`} onClick={() => setOpenMobile(false)}>
                      <MessageSquare className="h-4 w-4" />
                      <span className="truncate">{stripPastedTags(conversation.title)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })
          )}
        </SidebarMenu>
      </div>
    </SidebarGroup>
  )
}
