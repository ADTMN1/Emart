import fs from 'fs';
import path from 'path';

interface KnowledgeDocument {
  filename: string;
  title: string;
  content: string;
  keywords: string[];
}

export class KnowledgeService {
  private knowledgeBase: KnowledgeDocument[] = [];
  private knowledgePath: string;

  constructor() {
    this.knowledgePath = path.join(__dirname, '../../ai/knowledge');
    this.loadKnowledge();
  }

  /**
   * Load all knowledge documents from the ai/knowledge directory
   */
  private loadKnowledge(): void {
    try {
      const files = fs.readdirSync(this.knowledgePath);
      
      files.forEach(file => {
        if (file.endsWith('.md')) {
          const filepath = path.join(this.knowledgePath, file);
          const content = fs.readFileSync(filepath, 'utf-8');
          const title = this.extractTitle(content);
          const keywords = this.extractKeywords(file, title, content);

          this.knowledgeBase.push({
            filename: file,
            title,
            content,
            keywords,
          });
        }
      });

      console.log(`✓ Loaded ${this.knowledgeBase.length} knowledge documents`);
    } catch (error) {
      console.error('Error loading knowledge base:', error);
      throw new Error('Failed to load knowledge base');
    }
  }

  /**
   * Extract title from markdown content (first # heading)
   */
  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : 'Untitled';
  }

  /**
   * Extract keywords from filename, title, and content for matching
   */
  private extractKeywords(filename: string, title: string, content: string): string[] {
    const keywords: string[] = [];

    // Add filename-based keywords
    const baseName = filename.replace('.md', '');
    keywords.push(baseName, ...baseName.split('-'));

    // Add title words
    keywords.push(...title.toLowerCase().split(/\s+/));

    // Extract important terms from content (headers and bold text)
    const headers = content.match(/^#+\s+(.+)$/gm) || [];
    headers.forEach(header => {
      const text = header.replace(/^#+\s+/, '');
      keywords.push(...text.toLowerCase().split(/\s+/));
    });

    // Remove duplicates and common words
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were'];
    return [...new Set(keywords)]
      .filter(word => word.length > 2 && !stopWords.includes(word));
  }

  /**
   * Search knowledge base and return relevant documents
   * Simple keyword-based search without embeddings
   */
  search(query: string): KnowledgeDocument[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

    // Score each document based on keyword matches
    const scored = this.knowledgeBase.map(doc => {
      let score = 0;
      const contentLower = doc.content.toLowerCase();

      // Check for exact phrase match (highest score)
      if (contentLower.includes(queryLower)) {
        score += 10;
      }

      // Check for keyword matches
      queryWords.forEach(word => {
        // Title match (high weight)
        if (doc.title.toLowerCase().includes(word)) {
          score += 5;
        }

        // Keyword match (medium weight)
        if (doc.keywords.includes(word)) {
          score += 3;
        }

        // Content match (lower weight)
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length * 0.5;
        }
      });

      return { doc, score };
    });

    // Sort by score and return top matches (score > 0)
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Return top 3 most relevant documents
      .map(item => item.doc);
  }

  /**
   * Get relevant context for AI based on user query
   */
  getRelevantContext(query: string): string {
    const relevantDocs = this.search(query);

    if (relevantDocs.length === 0) {
      return '';
    }

    // Build context string from relevant documents
    let context = '=== EMART KNOWLEDGE BASE ===\n\n';
    context += 'The following information is from EMART\'s official documentation. Use this information to answer the user\'s question accurately.\n\n';

    relevantDocs.forEach((doc, index) => {
      context += `--- Document ${index + 1}: ${doc.title} ---\n\n`;
      context += doc.content;
      context += '\n\n';
    });

    context += '=== END OF KNOWLEDGE BASE ===\n\n';
    context += 'IMPORTANT: Only use information from the knowledge base above. If the knowledge base doesn\'t contain the answer, tell the user you don\'t have that specific information.\n';

    return context;
  }

  /**
   * Get all available knowledge topics
   */
  getAvailableTopics(): string[] {
    return this.knowledgeBase.map(doc => doc.title);
  }

  /**
   * Reload knowledge base (useful for updates)
   */
  reload(): void {
    this.knowledgeBase = [];
    this.loadKnowledge();
  }
}

export default new KnowledgeService();
