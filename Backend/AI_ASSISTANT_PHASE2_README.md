# EMART AI Shopping Assistant - Phase 2: Knowledge System + RAG

## Overview

Phase 2 extends the EMART AI Shopping Assistant with a Knowledge Retrieval system (RAG - Retrieval-Augmented Generation). The AI now has access to comprehensive EMART documentation and provides accurate, specific answers based on official company information.

## What's New in Phase 2

### Knowledge Base
- 10 structured markdown documents covering all EMART operations
- Keyword-based retrieval system
- Automatic context injection to AI responses

### Enhanced AI Capabilities
- **Specific Information**: Can now provide exact fees, costs, timelines, and policies
- **Knowledge-Grounded**: All responses backed by official documentation
- **Honest About Limitations**: Still admits when information isn't available

## Knowledge Documents

The knowledge base includes:

1. **company.md** - EMART company information and mission
2. **how-it-works.md** - Step-by-step explanation of the EMART process
3. **proxy-fees.md** - Complete proxy fee structure with exact costs
4. **domestic-shipping.md** - Japanese domestic shipping information
5. **international-shipping.md** - International shipping methods, costs, and zones
6. **warehouse.md** - Warehouse services, storage, and processing
7. **payments.md** - Payment methods, currencies, and refund information
8. **returns-refunds.md** - Complete return and refund policies
9. **prohibited-items.md** - Comprehensive list of prohibited/restricted items
10. **faq.md** - Frequently asked questions

Location: `/home/nati/Documents/project/Emart/Backend/ai/knowledge/`

## Architecture

### Knowledge Retrieval Flow

```
User Question
    ↓
Knowledge Service
    ↓
Search & Rank Documents
    ↓
Retrieve Top 3 Relevant Docs
    ↓
Build Context String
    ↓
AI Service (with Context)
    ↓
Gemini Response
    ↓
User Answer
```

### Components

#### 1. Knowledge Service (`src/services/knowledge.service.ts`)
- **Loads** all markdown documents at startup
- **Indexes** documents by keywords extracted from titles, headers, and content
- **Searches** using keyword matching and scoring
- **Returns** top 3 most relevant documents for any query

**Key Methods:**
- `search(query)` - Find relevant documents
- `getRelevantContext(query)` - Build context string for AI
- `reload()` - Reload knowledge base after updates

**Search Algorithm:**
- Exact phrase match: +10 points
- Title match: +5 points per word
- Keyword match: +3 points per word
- Content match: +0.5 points per occurrence
- Returns top 3 documents with score > 0

#### 2. Updated AI Service (`src/services/ai.service.ts`)
- **Retrieves** relevant knowledge before generating response
- **Injects** knowledge context into system prompt
- **Instructs** AI to use only knowledge base information
- **Maintains** Phase 1 validation and error handling

**Enhanced System Instruction:**
```
CRITICAL RULES:
1. ONLY use information from the EMART Knowledge Base
2. DO NOT invent policies, fees, or information
3. If knowledge base has the answer, use it
4. If knowledge base doesn't have the answer, say so
5. Cite specific numbers from knowledge base
```

## Example Queries and Responses

### Before Phase 2 (General Information Only)
**Q:** "How much is the proxy fee for a ¥3,000 item?"  
**A:** "I don't have access to specific pricing information..."

### After Phase 2 (Specific Knowledge)
**Q:** "How much is the proxy fee for a ¥3,000 item?"  
**A:** "For an item that costs ¥3,000, the EMART proxy fee is **¥500**. According to our fee structure, all items priced between ¥0 and ¥5,000 have a flat proxy fee of ¥500 per item."

### More Examples

**Q:** "How long can I store items for free?"  
**A:** "You can store your items at the EMART warehouse for **60 days for free** from the date your first item arrives."

**Q:** "What does photo inspection cost?"  
**A:** "Photo inspection costs depend on the level of detail:
- **Basic (3-5 photos):** ¥200
- **Detailed (10+ photos):** ¥500"

**Q:** "Can I ship lithium batteries?"  
**A:** "Yes, but restrictions apply:
- Loose lithium batteries: Prohibited in most shipping methods
- Devices with installed batteries: Allowed with restrictions
- Power banks: Maximum 100Wh, must be in original packaging"

## API - No Changes

The API endpoint remains the same:

**POST** `/api/v1/ai/chat`

```json
{
  "message": "How much does shipping to USA cost?"
}
```

Response now includes knowledge-based information:

```json
{
  "success": true,
  "message": "AI response generated successfully",
  "data": {
    "message": "Shipping a 1kg package to the USA via EMS costs **¥3,500**..."
  }
}
```

## Setup & Installation

### No Additional Dependencies
Phase 2 uses only Node.js built-in `fs` and `path` modules. No new npm packages required.

### Knowledge Base Location
All knowledge documents must be in:
```
Backend/ai/knowledge/*.md
```

### Automatic Loading
- Knowledge base loads automatically when server starts
- Console shows: `✓ Loaded 10 knowledge documents`
- No manual initialization needed

### Updating Knowledge
1. Edit any `.md` file in `ai/knowledge/`
2. Restart the server
3. New information is immediately available

Or programmatically:
```typescript
import knowledgeService from './services/knowledge.service';
knowledgeService.reload();
```

## Testing

### Run Phase 2 Tests
```bash
./test-ai-phase2.sh
```

### Run Phase 1 Tests (Compatibility Check)
```bash
./test-ai-endpoint.sh
```

Both test suites should pass, confirming backward compatibility.

## Performance

### Knowledge Retrieval
- **Load Time**: < 100ms (10 documents)
- **Search Time**: < 5ms per query
- **Memory Usage**: ~500KB for all documents

### Response Time
- Similar to Phase 1 (~800-1500ms)
- Small overhead for knowledge retrieval (~5ms)
- Gemini API remains the bottleneck

## Limitations

### Current Implementation
- **No Vector Embeddings**: Uses keyword-based search (sufficient for 10 documents)
- **No Semantic Search**: Matches exact words, not concepts
- **Static Documents**: Knowledge base loaded at startup
- **No Conversation Memory**: Each request is independent

### Not Implemented (As Required)
- ✗ Product database search
- ✗ Vector embeddings
- ✗ Order management tools
- ✗ Cart actions
- ✗ Payment processing
- ✗ Mercari integration

### When to Add Vector Embeddings

Consider adding embeddings when:
- Knowledge base grows beyond 50 documents
- Need semantic search (concept matching)
- Need multi-language support
- Search accuracy becomes insufficient

Current keyword search is sufficient for 10 well-structured documents.

## Security

- Knowledge documents are server-side only
- No user-provided content in knowledge base
- Knowledge base is read-only at runtime
- Same security model as Phase 1

## Maintenance

### Adding New Documents
1. Create new `.md` file in `ai/knowledge/`
2. Use clear headings and structure
3. Restart server
4. Test with relevant queries

### Updating Existing Documents
1. Edit the `.md` file
2. Restart server
3. Verify changes with test queries

### Document Format Best Practices
- Use `# Heading` for title
- Use `## Subheading` for sections
- Use `**bold**` for important numbers/terms
- Use bullet points for lists
- Use tables for structured data
- Keep language clear and precise

## Backward Compatibility

✅ **Phase 1 functionality fully preserved:**
- Empty message validation still works
- General questions still answered
- Error handling unchanged
- API contract unchanged
- Same timeout behavior
- Same response format

## Next Steps (Future Phases)

Phase 2 focuses on EMART knowledge. Future phases may include:
- Product database integration (search actual products)
- Order management tools (check status, modify orders)
- Cart actions (add/remove items via chat)
- User authentication (personalized responses)
- Conversation memory (multi-turn context)
- Vector embeddings (for larger knowledge base)

## Troubleshooting

### Knowledge Not Loading
**Error:** `Error loading knowledge base`  
**Solution:** Check that `ai/knowledge/` directory exists with `.md` files

### AI Not Using Knowledge
**Symptom:** Responses still say "I don't have that information"  
**Check:**
1. Knowledge documents contain relevant keywords
2. Server restarted after adding documents
3. Console shows documents loaded

### Search Not Finding Documents
**Issue:** Relevant documents not retrieved  
**Solution:**
- Add more keywords to document headers
- Use synonyms in content
- Check for typos in documents

### Rate Limiting
**Error:** 429 Too Many Requests  
**Cause:** Gemini API free tier limit (20 requests/day for gemini-3.6-flash)  
**Solution:**
- Wait for quota reset
- Upgrade to paid plan
- Use older model with higher limits

## Files Changed/Created

### Created Files
```
ai/knowledge/company.md
ai/knowledge/how-it-works.md
ai/knowledge/proxy-fees.md
ai/knowledge/domestic-shipping.md
ai/knowledge/international-shipping.md
ai/knowledge/warehouse.md
ai/knowledge/payments.md
ai/knowledge/returns-refunds.md
ai/knowledge/prohibited-items.md
ai/knowledge/faq.md
src/services/knowledge.service.ts
test-ai-phase2.sh
AI_ASSISTANT_PHASE2_README.md
AI_ASSISTANT_PHASE2_TESTS.md
```

### Modified Files
```
src/services/ai.service.ts (enhanced with knowledge retrieval)
```

### Unchanged Files
```
src/controllers/ai.controller.ts (no changes)
src/routes/ai.routes.ts (no changes)
src/middleware/validations/ai.validation.ts (no changes)
.env (no new variables)
```

## Support

For questions about Phase 2 implementation:
- Review this README
- Check test scripts for examples
- Examine knowledge documents for format
- See `knowledge.service.ts` for search algorithm
