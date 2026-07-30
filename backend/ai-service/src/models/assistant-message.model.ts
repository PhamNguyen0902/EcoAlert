import { HydratedDocument, Schema, Types } from 'mongoose';
import { assistantConnection } from '../config/database.config';

export interface IAssistantSourceRecord {
  id: string;
  title: string;
  href?: string;
  type: 'knowledge' | 'dynamic';
}

export interface IAssistantMessage {
  conversationId: Types.ObjectId;
  userId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources: IAssistantSourceRecord[];
  provider?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new Schema<IAssistantSourceRecord>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    href: { type: String },
    type: { type: String, enum: ['knowledge', 'dynamic'], required: true },
  },
  { _id: false },
);

const messageSchema = new Schema<IAssistantMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'AssistantConversation',
    },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['USER', 'ASSISTANT'], required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    sources: { type: [sourceSchema], default: [] },
    provider: { type: String, maxlength: 64 },
  },
  { timestamps: true, collection: 'assistant_messages' },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });

export type AssistantMessageDocument = HydratedDocument<IAssistantMessage>;

export const AssistantMessage =
  assistantConnection.models.AssistantMessage ||
  assistantConnection.model<IAssistantMessage>('AssistantMessage', messageSchema);
