import mongoose, { Types } from 'mongoose';
import { createLogger } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';
import { AssistantConversation } from '../models/conversation.model';
import { AssistantMessage } from '../models/assistant-message.model';
import { detectAssistantIntent } from '../assistant/intent-detector';
import { knowledgeSources, retrieveKnowledge } from '../assistant/knowledge';
import { createAssistantLlmProvider, ChatHistoryTurn } from '../assistant/llm-provider';
import { retrieveAuthorizedData } from '../assistant/authorized-data.retriever';
import { toolForIntent } from '../assistant/tool-registry';
import {
  AssistantConversationDto,
  AssistantHttpError,
  AssistantMessageDto,
  AssistantSource,
  AuthorizedActor,
} from '../assistant/types';
import { assistantRedis } from './redis.service';
import { AiTask } from './ai-task-router';

const logger = createLogger('ai-service');
const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_LIMIT = 12;

type ConversationRecord = {
  _id: Types.ObjectId;
  title: string;
  role: AssistantConversationDto['role'];
  lastMessageAt: Date;
  createdAt: Date;
};

type MessageRecord = {
  _id: Types.ObjectId;
  role: AssistantMessageDto['role'];
  content: string;
  sources: AssistantSource[];
  provider?: string;
  model?: string;
  createdAt: Date;
};

const normalizeMessage = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new AssistantHttpError(400, 'Message must be plain text');
  }
  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!normalized) throw new AssistantHttpError(400, 'Message cannot be empty');
  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new AssistantHttpError(400, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
  }
  return normalized;
};

const uniqueSources = (sources: AssistantSource[]): AssistantSource[] =>
  sources.filter((source, index) => sources.findIndex((item) => item.id === source.id) === index);

const conversationDto = (conversation: ConversationRecord): AssistantConversationDto => ({
  id: conversation._id.toString(),
  title: conversation.title,
  role: conversation.role,
  lastMessageAt: conversation.lastMessageAt.toISOString(),
  createdAt: conversation.createdAt.toISOString(),
});

const messageDto = (message: MessageRecord): AssistantMessageDto => ({
  id: message._id.toString(),
  role: message.role,
  content: message.content,
  sources: message.sources || [],
  createdAt: message.createdAt.toISOString(),
});

const fallbackAnswer = (
  isWriteRequest: boolean,
  knowledge: { content: string }[],
  dynamicText?: string,
): string => {
  const guidance = knowledge.map((chunk) => `• ${chunk.content}`).join('\n');
  if (isWriteRequest) {
    return `I’m read-only, so I can’t make that change or submit anything for you. I can explain the safe workflow and point you to the relevant EcoAlert screen.\n\n${guidance}`;
  }
  return `${dynamicText ? `${dynamicText}\n\n` : ''}Here is the relevant EcoAlert guidance:\n${guidance}`;
};

export class AssistantService {
  private readonly provider = createAssistantLlmProvider();

  async listConversations(actor: AuthorizedActor): Promise<AssistantConversationDto[]> {
    const conversations = (await AssistantConversation.find({ userId: actor.userId })
      .sort({ lastMessageAt: -1 })
      .limit(30)
      .lean()) as unknown as ConversationRecord[];
    return conversations.map(conversationDto);
  }

  async createConversation(actor: AuthorizedActor, title = 'New conversation'): Promise<AssistantConversationDto> {
    const safeTitle = title.replace(/\s+/g, ' ').trim().slice(0, 120) || 'New conversation';
    const conversation = await AssistantConversation.create({
      userId: actor.userId,
      role: actor.role,
      title: safeTitle,
      lastMessageAt: new Date(),
    });
    return conversationDto(conversation.toObject() as ConversationRecord);
  }

  async getMessages(actor: AuthorizedActor, conversationId: string): Promise<AssistantMessageDto[]> {
    await this.requireConversation(actor, conversationId);
    const messages = (await AssistantMessage.find({
      conversationId,
      userId: actor.userId,
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean()) as unknown as MessageRecord[];
    return messages.map(messageDto);
  }

  async sendMessage(
    actor: AuthorizedActor,
    request: { conversationId?: unknown; message?: unknown },
  ): Promise<{ conversation: AssistantConversationDto; message: AssistantMessageDto }> {
    const content = normalizeMessage(request.message);
    const withinLimit = await assistantRedis.consumeRateLimit(
      `assistant:rate:v1:${actor.userId}`,
      Math.max(1, envConfig.assistantRateLimit),
      Math.max(1, envConfig.assistantRateWindowSeconds),
    );
    if (!withinLimit) {
      throw new AssistantHttpError(429, 'Assistant is busy. Please wait a moment and try again.');
    }

    const conversation = await this.resolveConversation(actor, request.conversationId, content);
    const history = (await AssistantMessage.find({
      conversationId: conversation._id,
      userId: actor.userId,
    })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean()) as unknown as MessageRecord[];

    await AssistantMessage.create({
      conversationId: conversation._id,
      userId: actor.userId,
      role: 'USER',
      content,
      sources: [],
    });

    const intent = detectAssistantIntent(content, actor.role);
    const knowledge = retrieveKnowledge(content, actor.role);
    const writeRequest = intent === 'WRITE_REQUEST';
    const selectedTool = writeRequest ? undefined : toolForIntent(intent, actor.role);
    const dynamicContext = selectedTool
      ? await retrieveAuthorizedData(actor, intent, content)
      : undefined;
    const sources = uniqueSources([
      ...knowledgeSources(knowledge),
      ...(dynamicContext?.sources || []),
    ]);

    const prompt = this.buildSystemPrompt(actor, knowledge.map((chunk) => chunk.content), dynamicContext?.text);
    const turns: ChatHistoryTurn[] = history
      .reverse()
      .map((message) => ({ role: message.role, content: message.content }));
    let responseContent = fallbackAnswer(writeRequest, knowledge, dynamicContext?.text);
    let providerName = 'grounded-fallback';
    let providerModel: string | undefined;

    if (this.provider.isConfigured) {
      try {
        const generation = await this.provider.generate(prompt, turns, content);
        responseContent = generation.content;
        providerName = generation.provider;
        providerModel = generation.model;
      } catch (error) {
        logger.warn(`Assistant provider unavailable for request ${actor.requestId || 'unknown'}`);
      }
    }

    const assistantMessage = await AssistantMessage.create({
      conversationId: conversation._id,
      userId: actor.userId,
      role: 'ASSISTANT',
      content: responseContent.slice(0, 4000),
      sources,
      provider: providerName,
      model: providerModel,
    });

    conversation.lastMessageAt = new Date();
    if (conversation.title === 'New conversation') {
      conversation.title = content.replace(/\s+/g, ' ').slice(0, 80);
    }
    await conversation.save();

    logger.info('Assistant response created', {
      requestId: actor.requestId || 'unknown',
      role: actor.role,
      intent,
      tool: selectedTool || 'none',
      provider: providerName,
      task: AiTask.CHAT,
      model: providerModel,
    });

    return {
      conversation: conversationDto(conversation.toObject() as ConversationRecord),
      message: messageDto(assistantMessage.toObject() as MessageRecord),
    };
  }

  private async resolveConversation(
    actor: AuthorizedActor,
    value: unknown,
    initialMessage: string,
  ) {
    if (typeof value !== 'string' || !value.trim()) {
      return AssistantConversation.create({
        userId: actor.userId,
        role: actor.role,
        title: initialMessage.replace(/\s+/g, ' ').slice(0, 80),
        lastMessageAt: new Date(),
      });
    }
    return this.requireConversation(actor, value);
  }

  private async requireConversation(actor: AuthorizedActor, conversationId: string) {
    if (!mongoose.isValidObjectId(conversationId)) {
      throw new AssistantHttpError(404, 'Conversation not found');
    }
    const conversation = await AssistantConversation.findOne({
      _id: conversationId,
      userId: actor.userId,
    });
    if (!conversation) throw new AssistantHttpError(404, 'Conversation not found');
    return conversation;
  }

  private buildSystemPrompt(
    actor: AuthorizedActor,
    knowledge: string[],
    dynamicContext?: string,
  ): string {
    return [
      'You are EcoAlert AI Assistant, a concise environmental incident platform guide.',
      `The authenticated role is ${actor.role}.`,
      'You are strictly read-only: never claim to create, submit, update, assign, resolve, close, delete, or notify.',
      'Never disclose data not present in the approved context. Do not infer identities, incident ownership, or hidden fields.',
      'Use only the approved knowledge and authorized dynamic context below. If it does not answer the question, say what the user can check next.',
      'For immediate danger, advise the user to contact local emergency services first.',
      'Use short paragraphs or bullets. Do not invent citations or URLs.',
      `Approved knowledge:\n${knowledge.map((item) => `- ${item}`).join('\n')}`,
      dynamicContext ? `Authorized dynamic context:\n${dynamicContext}` : 'Authorized dynamic context: none.',
    ].join('\n\n');
  }
}

export const assistantService = new AssistantService();
