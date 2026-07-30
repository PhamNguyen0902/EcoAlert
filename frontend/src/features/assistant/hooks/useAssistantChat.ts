import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assistantService } from '@/services/services';
import type { AssistantConversation, AssistantMessage } from '@/types';

const conversationKey = ['assistant', 'conversations'] as const;
const messageKey = (conversationId: string) => ['assistant', 'messages', conversationId] as const;

export function useAssistantChat() {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewConversation, setIsNewConversation] = useState(false);
  const conversations = useQuery({
    queryKey: conversationKey,
    queryFn: assistantService.getConversations,
    staleTime: 15_000,
  });
  const messages = useQuery({
    queryKey: activeConversationId ? messageKey(activeConversationId) : ['assistant', 'messages', 'new'],
    queryFn: () => assistantService.getMessages(activeConversationId!),
    enabled: Boolean(activeConversationId),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!activeConversationId && !isNewConversation && conversations.data?.[0]) {
      setActiveConversationId(conversations.data[0].id);
    }
  }, [activeConversationId, conversations.data, isNewConversation]);

  const send = useMutation({
    mutationFn: (message: string) => assistantService.sendMessage(message, activeConversationId || undefined),
    onSuccess: (reply, sentMessage) => {
      const userMessage: AssistantMessage = {
        id: `local-${reply.message.id}`,
        role: 'USER',
        content: sentMessage,
        sources: [],
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<AssistantMessage[]>(messageKey(reply.conversation.id), (current = []) => [
        ...current,
        userMessage,
        reply.message,
      ]);
      queryClient.setQueryData<AssistantConversation[]>(conversationKey, (current = []) => [
        reply.conversation,
        ...current.filter((conversation) => conversation.id !== reply.conversation.id),
      ]);
      setActiveConversationId(reply.conversation.id);
      setIsNewConversation(false);
    },
  });

  return {
    activeConversationId,
    setActiveConversationId: (conversationId: string | null) => {
      setActiveConversationId(conversationId);
      setIsNewConversation(false);
    },
    conversations,
    messages,
    send,
    startNewConversation: () => {
      setActiveConversationId(null);
      setIsNewConversation(true);
    },
  };
}
