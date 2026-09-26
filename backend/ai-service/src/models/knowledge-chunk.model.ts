import mongoose, { Schema, Document } from 'mongoose';

export interface IKnowledgeChunk extends Document {
  chunk_id: string;
  document_id: string;
  category: string;
  target_role: string;
  doc_type: string;
  section_type: 'overview' | 'step' | 'faq';
  step_number?: number;
  title: string;
  related_actions?: string[];
  content: string;
  embedding: number[];
  char_count: number;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeChunkSchema: Schema = new Schema(
  {
    chunk_id: { type: String, required: true, unique: true, index: true },
    document_id: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    target_role: { type: String, required: true, index: true },
    doc_type: { type: String, required: true },
    section_type: { type: String, required: true, enum: ['overview', 'step', 'faq'] },
    step_number: { type: Number },
    title: { type: String, required: true },
    related_actions: [{ type: String }],
    content: { type: String, required: true },
    embedding: { type: [Number], required: true },
    char_count: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

export const KnowledgeChunkModel = mongoose.model<IKnowledgeChunk>(
  'KnowledgeChunk',
  KnowledgeChunkSchema,
  'knowledge_chunks'
);