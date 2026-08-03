import { api } from "./client";
import type {
  ApiResponse,
  AssistantConversation,
  AssistantMessage,
  AssistantReply,
} from "../types";

export const assistantService = {
  getConversations: async (): Promise<AssistantConversation[]> => {
    const response = await api.get<ApiResponse<AssistantConversation[]>>("/v1/assistant/conversations");
    return response.data.data;
  },

  getMessages: async (conversationId: string): Promise<AssistantMessage[]> => {
    const response = await api.get<ApiResponse<AssistantMessage[]>>(
      `/v1/assistant/conversations/${conversationId}/messages`,
    );
    return response.data.data;
  },

  createConversation: async (title?: string): Promise<AssistantConversation> => {
    const response = await api.post<ApiResponse<AssistantConversation>>(
      "/v1/assistant/conversations",
      { title },
    );
    return response.data.data;
  },

  sendMessage: async (message: string, conversationId?: string): Promise<AssistantReply> => {
    const response = await api.post<ApiResponse<AssistantReply>>("/v1/assistant/messages", {
      message,
      conversationId,
    });
    return response.data.data;
  },
};
