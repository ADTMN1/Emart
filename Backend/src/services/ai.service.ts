import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/env';
import { ValidationError } from '../utils/errors';
import knowledgeService from './knowledge.service';

export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });
  }

  async chat(userMessage: string): Promise<string> {
    if (!userMessage || userMessage.trim().length === 0) {
      throw new ValidationError('Message cannot be empty');
    }

    // Retrieve relevant knowledge based on user's question
    const relevantContext = knowledgeService.getRelevantContext(userMessage);

    const systemInstruction = `You are the EMART shopping assistant. EMART is a global proxy shopping platform that helps customers buy products from international marketplaces.

CRITICAL RULES:
1. You MUST ONLY use information from the EMART Knowledge Base provided below.
2. You MUST NOT invent or fabricate any EMART policies, fees, shipping costs, processing times, or business information.
3. If the knowledge base contains the answer, use it to provide accurate, specific information.
4. If the knowledge base does NOT contain the answer, clearly state that you don't have that specific information and suggest contacting support.
5. Be helpful, friendly, and professional.
6. When providing specific numbers (fees, shipping costs, timeframes), cite them from the knowledge base exactly.

${relevantContext}

Remember: ONLY use information from the knowledge base above. Do not make up policies, prices, or procedures.`;

    try {
      const chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: systemInstruction }],
          },
          {
            role: 'model',
            parts: [{ text: 'I understand. I am the EMART shopping assistant and will ONLY use information from the official EMART knowledge base provided. I will not invent any policies, prices, shipping costs, or other business information. If the information is not in the knowledge base, I will clearly state that I don\'t have that specific information. I\'m ready to help!' }],
          },
        ],
      });

      // Set timeout for the API call
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI service timeout')), 30000);
      });

      const responsePromise = chat.sendMessage(userMessage);

      const result = await Promise.race([responsePromise, timeoutPromise]);
      const response = await result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from AI service');
      }

      return text;
    } catch (error: any) {
      // Handle timeout specifically
      if (error.message === 'AI service timeout') {
        // Try fallback to knowledge base
        const fallback = this.buildFallbackAnswer(userMessage);
        if (fallback) return fallback;
        throw new Error('The request took too long to process. Please try again.');
      }

      // Log error for debugging (in production, use proper logging)
      console.error('AI Service Error:', error);

      // If the generative model is unavailable (503 or network issues), provide a KB-based fallback
      const fallback = this.buildFallbackAnswer(userMessage);
      if (fallback) return fallback;

      throw new Error('Failed to process your message. Please try again later.');
    }
  }

  private buildFallbackAnswer(query: string): string | null {
    try {
      const docs = knowledgeService.search(query);
      if (!docs || docs.length === 0) return null;

      // Build a concise fallback from the top document(s)
      const snippets = docs.map((doc) => {
        // Extract first paragraph (up to first double newline)
        const firstParagraph = doc.content.split(/\n\n+/)[0].replace(/\r/g, '').trim();
        const snippet = firstParagraph.length > 600 ? firstParagraph.slice(0, 600) + '...' : firstParagraph;
        return `• ${doc.title}: ${snippet}`;
      });

      const message = [
        "Our AI service is temporarily unavailable. Here's relevant information from EMART's knowledge base:",
        ...snippets,
        "If this doesn't answer your question, please try again later or contact support.",
      ].join('\n\n');

      return message;
    } catch (err) {
      console.error('Fallback generation error:', err);
      return null;
    }
  }
}

export default new AIService();
