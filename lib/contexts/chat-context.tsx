'use client';

import { createContext, useContext } from 'react';

interface ChatContextValue {
  sendMessage: (message: string) => void;
  isStreaming: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  children,
  sendMessage,
  isStreaming,
}: {
  children: React.ReactNode;
  sendMessage: (message: string) => void;
  isStreaming: boolean;
}) {
  return (
    <ChatContext.Provider value={{ sendMessage, isStreaming }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  return context;
}
