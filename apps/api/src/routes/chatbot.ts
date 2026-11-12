import { Router, type RequestHandler } from 'express';
import { ChatbotInputSchema } from '@kosmatch/shared';
import { requireRole } from '../middleware/auth';
import { asyncHandler, ok, validate } from '../middleware/http';
import type { ChatbotService } from '../services/chatbotService';

/**
 * Chatbot route handler integrating the 4-Layer AI Guardrails & Agentic Tool Calling pipeline.
 */
export function createChatbotRouter(chatbotService: ChatbotService, authMiddleware: RequestHandler): Router {
  const router = Router();

  router.post(
    '/',
    authMiddleware,
    requireRole('tenant'),
    validate(ChatbotInputSchema),
    asyncHandler(async (req, res) => {
      const { message } = req.body as { message: string };
      const userId = req.user?.id;
      const response = await chatbotService.ask(message, { userId });
      ok(res, response);
    }),
  );

  return router;
}
