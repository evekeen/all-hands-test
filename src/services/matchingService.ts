import OpenAI from 'openai';
import prisma from '../models/db';
import { mockRfqs } from './mockRfqData';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-demo-key'
});

interface CatalogItemData {
  id: string;
  name: string;
  keywords: string[];
  categories: string[];
  skus: string[];
}

interface RfqData {
  fairmarkitId: string;
  title: string;
  description: string;
  category: string;
  closingDate: Date;
}

// System prompt for the LLM
const MATCHING_SYSTEM_PROMPT = `You are an expert B2B procurement matching algorithm. Your job is to score how well a supplier's catalog item matches a Request for Quotation (RFQ).

Scoring Guidelines:
- 0.0-0.3: No meaningful match - different products/categories
- 0.4-0.5: Weak match - some keywords overlap but not a strong fit
- 0.6-0.7: Moderate match - relevant category and some keywords
- 0.8-0.9: Strong match - very relevant, likely a good bid opportunity
- 1.0: Perfect match - nearly identical product requirements

Consider:
1. Product type similarity
2. Keywords and search terms alignment
3. Category relevance
4. Quantity compatibility
5. Industry fit

Respond with ONLY a JSON object containing:
{
  "score": <number between 0 and 1>,
  "reasoning": "<brief explanation of why this score was given>",
  "matchedKeywords": ["keyword1", "keyword2"],
  "bidRecommendation": "bid" | "consider" | "skip"
}`;

export async function runMatchingForSupplier(supplierId: string): Promise<void> {
  console.log(`🔍 Running matching for supplier ${supplierId}...`);
  
  // Get supplier's catalog
  const catalogItems = await prisma.catalogItem.findMany({
    where: { supplierId }
  });
  
  if (catalogItems.length === 0) {
    console.log(`⚠️ No catalog items found for supplier ${supplierId}`);
    return;
  }
  
  // Get or create RFQs
  for (const mockRfq of mockRfqs) {
    let rfq = await prisma.rfq.findUnique({
      where: { fairmarkitId: mockRfq.fairmarkitId }
    });
    
    if (!rfq) {
      rfq = await prisma.rfq.create({
        data: {
          fairmarkitId: mockRfq.fairmarkitId,
          title: mockRfq.title,
          description: mockRfq.description,
          category: mockRfq.category,
          closingDate: mockRfq.closingDate,
          rawData: JSON.stringify(mockRfq)
        }
      });
    }
    
    // Check if match already exists
    const existingMatch = await prisma.match.findFirst({
      where: { supplierId, rfqId: rfq.id }
    });
    
    if (existingMatch) {
      console.log(`  ⏭️  Match already exists for ${mockRfq.fairmarkitId}`);
      continue;
    }
    
    // Score each catalog item against this RFQ
    let bestMatch = { score: 0, item: null as CatalogItemData | null, reasoning: '', matchedKeywords: [] as string[], recommendation: 'skip' };
    
    for (const item of catalogItems) {
      const parsedItem: CatalogItemData = {
        id: item.id,
        name: item.name,
        keywords: JSON.parse(item.keywords || '[]'),
        categories: JSON.parse(item.categories || '[]'),
        skus: JSON.parse(item.skus || '[]')
      };
      
      const result = await scoreMatch(mockRfq, parsedItem);
      
      if (result.score > bestMatch.score) {
        bestMatch = {
          score: result.score,
          item: parsedItem,
          reasoning: result.reasoning,
          matchedKeywords: result.matchedKeywords,
          recommendation: result.recommendation
        };
      }
    }
    
    // Create match if score is above threshold
    if (bestMatch.score >= 0.4 && bestMatch.item) {
      await prisma.match.create({
        data: {
          supplierId,
          rfqId: rfq.id,
          catalogItemId: bestMatch.item.id,
          confidenceScore: bestMatch.score,
          llmReasoning: bestMatch.reasoning,
          status: 'pending'
        }
      });
      
      console.log(`  ✅ Created match: ${mockRfq.fairmarkitId} (${bestMatch.item.name}) - Score: ${bestMatch.score.toFixed(2)}`);
    } else {
      console.log(`  ❌ No confident match for ${mockRfq.fairmarkitId} (best score: ${bestMatch.score.toFixed(2)})`);
    }
  }
  
  console.log(`✅ Matching complete for supplier ${supplierId}`);
}

async function scoreMatch(rfq: RfqData, catalogItem: CatalogItemData): Promise<{
  score: number;
  reasoning: string;
  matchedKeywords: string[];
  recommendation: 'bid' | 'consider' | 'skip';
}> {
  const userPrompt = `
RFQ Details:
- Title: ${rfq.title}
- Description: ${rfq.description}
- Category: ${rfq.category}

Supplier Catalog Item:
- Name: ${catalogItem.name}
- Keywords: ${catalogItem.keywords.join(', ')}
- Categories: ${catalogItem.categories.join(', ')}
- SKUs: ${catalogItem.skus.join(', ')}

Please score this match.
`;

  try {
    // For demo purposes, if no real API key, use rule-based fallback
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-demo-key') {
      return ruleBasedScore(rfq, catalogItem);
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: MATCHING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return ruleBasedScore(rfq, catalogItem);
    }
    
    const result = JSON.parse(content);
    return {
      score: Math.max(0, Math.min(1, result.score || 0)),
      reasoning: result.reasoning || 'No reasoning provided',
      matchedKeywords: result.matchedKeywords || [],
      recommendation: result.bidRecommendation || 'skip'
    };
  } catch (error) {
    console.error('LLM scoring error, falling back to rules:', error);
    return ruleBasedScore(rfq, catalogItem);
  }
}

// Fallback rule-based matching
function ruleBasedScore(rfq: RfqData, catalogItem: CatalogItemData): {
  score: number;
  reasoning: string;
  matchedKeywords: string[];
  recommendation: 'bid' | 'consider' | 'skip';
} {
  const rfqText = `${rfq.title} ${rfq.description} ${rfq.category}`.toLowerCase();
  const catalogText = [
    ...catalogItem.keywords,
    ...catalogItem.categories,
    ...catalogItem.skus,
    catalogItem.name
  ].join(' ').toLowerCase();
  
  const catalogTokens = catalogText.split(/\s+/).filter(t => t.length > 2);
  const matchedKeywords: string[] = [];
  
  for (const token of catalogTokens) {
    if (rfqText.includes(token)) {
      matchedKeywords.push(token);
    }
  }
  
  // Calculate category match
  const categoryMatch = catalogItem.categories.some(cat => 
    rfq.category.toLowerCase().includes(cat.toLowerCase()) ||
    rfqText.includes(cat.toLowerCase())
  ) ? 0.3 : 0;
  
  // Calculate keyword overlap
  const keywordScore = catalogItem.keywords.length > 0 
    ? (matchedKeywords.length / catalogItem.keywords.length) * 0.5 
    : 0;
  
  // Calculate base score from category
  const baseScore = categoryMatch > 0 ? 0.2 : 0;
  
  const score = Math.min(1, baseScore + keywordScore + (matchedKeywords.length > 0 ? 0.2 : 0));
  
  let recommendation: 'bid' | 'consider' | 'skip' = 'skip';
  if (score >= 0.7) recommendation = 'bid';
  else if (score >= 0.4) recommendation = 'consider';
  
  const reasoning = matchedKeywords.length > 0
    ? `Matched keywords: ${matchedKeywords.join(', ')}. ${categoryMatch ? 'Category matches.' : ''}`
    : 'No significant keyword matches found';
  
  return { score, reasoning, matchedKeywords, recommendation };
}

export async function runMatchingForAllSuppliers(): Promise<void> {
  console.log('🔄 Running matching for all suppliers...');
  
  const suppliers = await prisma.supplier.findMany();
  
  for (const supplier of suppliers) {
    await runMatchingForSupplier(supplier.id);
  }
  
  console.log('✅ All matching complete');
}
