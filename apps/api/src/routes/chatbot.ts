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
      const { message, activeKosIds, destinationId } = req.body as {
        message: string;
        activeKosIds?: string[];
        destinationId?: string;
      };
      const userId = req.user?.id;
      const response = await chatbotService.ask(message, { userId, activeKosIds, destinationId });
      ok(res, response);
    }),
  );

  return router;
}
