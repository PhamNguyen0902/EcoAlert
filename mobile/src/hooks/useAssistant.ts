import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assistantService } from "../api/assistantService";
import type { AssistantConversation, AssistantMessage } from "../types";

const conversationKey = ["assistant", "conversations"] as const;
const messagesKey = (conversationId?: string) => ["assistant", "messages", conversationId] as const;

export const useAssistantConversations = () =>
  useQuery({
    queryKey: conversationKey,
    queryFn: assistantService.getConversations,
    staleTime: 15 * 1000,
  });

export const useAssistantMessages = (conversationId?: string) =>
  useQuery({
    queryKey: messagesKey(conversationId),
    queryFn: () => assistantService.getMessages(conversationId as string),
    enabled: Boolean(conversationId),
    staleTime: 10 * 1000,
    retry: 1,
  });

export const useSendAssistantMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ message, conversationId }: { message: string; conversationId?: string }) =>
      assistantService.sendMessage(message, conversationId),
    onSuccess: (reply, variables) => {
      const localUserMessage: AssistantMessage = {
        id: `local-${reply.message.id}`,
        role: "USER",
        content: variables.message,
        sources: [],
        createdAt: reply.message.createdAt,
      };

      queryClient.setQueryData<AssistantMessage[]>(
        messagesKey(reply.conversation.id),
        (current = []) => [...current, localUserMessage, reply.message],
      );

      queryClient.setQueryData<AssistantConversation[]>(conversationKey, (current = []) => {
        const withoutUpdated = current.filter((item) => item.id !== reply.conversation.id);
        return [reply.conversation, ...withoutUpdated];
      });

      if (variables.conversationId && variables.conversationId !== reply.conversation.id) {
        queryClient.removeQueries({ queryKey: messagesKey(variables.conversationId) });
      }
    },
  });
};
