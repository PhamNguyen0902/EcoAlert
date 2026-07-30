import { NextFunction, Request, Response, Router } from 'express';
import { assistantController } from '../controllers/assistant.controller';
import { requireAssistantAuth } from '../middlewares/assistant-auth.middleware';

const router = Router();

const asyncHandler = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.use(requireAssistantAuth);
router.get('/conversations', asyncHandler(assistantController.listConversations.bind(assistantController)));
router.post('/conversations', asyncHandler(assistantController.createConversation.bind(assistantController)));
router.get('/conversations/:id/messages', asyncHandler(assistantController.listMessages.bind(assistantController)));
router.post('/messages', asyncHandler(assistantController.sendMessage.bind(assistantController)));

export default router;
