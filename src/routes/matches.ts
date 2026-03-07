import { Router, Response } from 'express';
import prisma from '../models/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { runMatchingForSupplier } from '../services/matchingService';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all matches for supplier
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      where: { supplierId: req.supplierId },
      include: {
        rfq: true,
        catalogItem: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(matches.map(match => ({
      ...match,
      rfq: {
        ...match.rfq,
        rawData: JSON.parse(match.rfq.rawData || '{}')
      },
      catalogItem: match.catalogItem ? {
        ...match.catalogItem,
        keywords: JSON.parse(match.catalogItem.keywords || '[]'),
        categories: JSON.parse(match.catalogItem.categories || '[]'),
        skus: JSON.parse(match.catalogItem.skus || '[]')
      } : null
    })));
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// Get single match
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const match = await prisma.match.findFirst({
      where: { id, supplierId: req.supplierId },
      include: {
        rfq: true,
        catalogItem: true
      }
    });
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    res.json({
      ...match,
      rfq: {
        ...match.rfq,
        rawData: JSON.parse(match.rfq.rawData || '{}')
      },
      catalogItem: match.catalogItem ? {
        ...match.catalogItem,
        keywords: JSON.parse(match.catalogItem.keywords || '[]'),
        categories: JSON.parse(match.catalogItem.categories || '[]'),
        skus: JSON.parse(match.catalogItem.skus || '[]')
      } : null
    });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ error: 'Failed to get match' });
  }
});

// Trigger matching (run LLM matching)
router.post('/run-matching', async (req: AuthRequest, res: Response) => {
  try {
    await runMatchingForSupplier(req.supplierId!);
    
    res.json({ 
      message: 'Matching completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Matching error:', error);
    res.status(500).json({ error: 'Failed to run matching' });
  }
});

// Update match status (viewed, bid_started)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'viewed', 'bid_started'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const match = await prisma.match.findFirst({
      where: { id, supplierId: req.supplierId }
    });
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    const updated = await prisma.match.update({
      where: { id },
      data: { status }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Update match error:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

// Delete a match
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const match = await prisma.match.findFirst({
      where: { id, supplierId: req.supplierId }
    });
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    await prisma.match.delete({ where: { id } });
    
    res.json({ message: 'Match deleted' });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

export default router;
