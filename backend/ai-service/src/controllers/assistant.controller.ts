import { Request, Response } from 'express';
import { successResponse } from '@ecoalert/shared';
import { AuthorizedActor } from '../assistant/types';
import { assistantService } from '../services/assistant.service';

const actorFor = (res: Response): AuthorizedActor => res.locals.actor as AuthorizedActor;

export class AssistantController {
  async listConversations(_req: Request, res: Response) {
    const conversations = await assistantService.listConversations(actorFor(res));
    res.json(successResponse(conversations));
  }

  async createConversation(req: Request, res: Response) {
    const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
    const conversation = await assistantService.createConversation(actorFor(res), title);
    res.status(201).json(successResponse(conversation, 'Conversation created'));
  }

  async listMessages(req: Request, res: Response) {
    const messages = await assistantService.getMessages(actorFor(res), req.params.id);
    res.json(successResponse(messages));
  }

  async sendMessage(req: Request, res: Response) {
    const response = await assistantService.sendMessage(actorFor(res), {
      conversationId: req.body?.conversationId,
      message: req.body?.message,
    });
    res.status(201).json(successResponse(response, 'Assistant response created'));
  }
}

export const assistantController = new AssistantController();
