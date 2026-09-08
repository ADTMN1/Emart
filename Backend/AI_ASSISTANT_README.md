# EMART AI Shopping Assistant

## Overview

The EMART AI Shopping Assistant is a server-side Google Gemini-powered chatbot that helps customers with general questions about EMART's proxy shopping service.

## Phase 1 Features

- General Q&A about EMART and proxy shopping
- Refuses to invent product information, prices, or policies
- Timeout handling (30 seconds)
- Request validation
- Error handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up your Gemini API key:
   - Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Add it to your `.env` file:
```env
GEMINI_API_KEY=your-actual-gemini-api-key-here
```

3. Start the server:
```bash
npm run dev
```

## API Usage

### Endpoint
```
POST /api/v1/ai/chat
```

### Request
```json
{
  "message": "What is EMART?"
}
```

### Success Response
```json
{
  "success": true,
  "message": "AI response generated successfully",
  "data": {
    "message": "EMART is a global proxy shopping platform..."
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## Testing

Run the test script:
```bash
./test-ai-endpoint.sh
```

Or test manually with curl:
```bash
curl -X POST http://localhost:5000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is proxy shopping?"}'
```

## Implementation Details

### Architecture
- **Service:** `src/services/ai.service.ts` - Gemini API integration
- **Controller:** `src/controllers/ai.controller.ts` - Request handling
- **Routes:** `src/routes/ai.routes.ts` - Endpoint definition
- **Validation:** `src/middleware/validations/ai.validation.ts` - Input validation

### Configuration
- **Model:** gemini-3.6-flash (latest as of September 2026)
- **Temperature:** 0.7
- **Max Output Tokens:** 1024
- **Message Length:** 1-2000 characters
- **Timeout:** 30 seconds

### System Instructions
The AI is configured to:
- Act as the EMART shopping assistant
- NOT invent products, prices, shipping costs, orders, or policies
- Only answer general questions about EMART and proxy shopping
- Direct users to appropriate channels for specific information

## Security
- API key stored server-side only
- Never exposed to frontend
- Input validation on all requests
- Generic error messages

## What's NOT in Phase 1
- RAG/embeddings (future phase)
- Product search integration (future phase)
- Order management tools (future phase)
- Payment integration (future phase)
- Conversation history (future phase)
- Rate limiting (add for production)

## See Also
- [Test Report](./AI_ASSISTANT_PHASE1_TESTS.md)
- [Test Script](./test-ai-endpoint.sh)
