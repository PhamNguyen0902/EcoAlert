import { HydratedDocument, Schema } from 'mongoose';
import { assistantConnection } from '../config/database.config';

export interface IAssistantConversation {
  userId: string;
  role: 'CITIZEN' | 'OFFICER' | 'ADMIN';
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IAssistantConversation>(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['CITIZEN', 'OFFICER', 'ADMIN'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    lastMessageAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: 'assistant_conversations' },
);

conversationSchema.index({ userId: 1, lastMessageAt: -1 });

export type AssistantConversationDocument = HydratedDocument<IAssistantConversation>;

export const AssistantConversation =
  assistantConnection.models.AssistantConversation ||
  assistantConnection.model<IAssistantConversation>(
    'AssistantConversation',
    conversationSchema,
  );
