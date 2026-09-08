import { Request, Response, NextFunction } from 'express';
import aiService from '../services/ai.service';
import { sendSuccess } from '../utils/response';

export class AIController {
  async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const { message } = req.body;

      const response = await aiService.chat(message);

      return sendSuccess(
        res,
        { message: response },
        'AI response generated successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

export default new AIController();
