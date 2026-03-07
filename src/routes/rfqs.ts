import { Router, Response } from 'express';
import prisma from '../models/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { mockRfqs } from '../services/mockRfqData';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all RFQs (mock data)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // Return mock RFQs with their match status for this supplier
    const rfqs = await prisma.rfq.findMany({
      orderBy: { scannedAt: 'desc' },
      include: {
        matches: {
          where: { supplierId: req.supplierId }
        }
      }
    });
    
    if (rfqs.length === 0) {
      // Initialize mock RFQs in database
      const createdRfqs = [];
      for (const mockRfq of mockRfqs) {
        const rfq = await prisma.rfq.create({
          data: {
            fairmarkitId: mockRfq.fairmarkitId,
            title: mockRfq.title,
            description: mockRfq.description,
            category: mockRfq.category,
            closingDate: mockRfq.closingDate,
            rawData: JSON.stringify(mockRfq)
          }
        });
        createdRfqs.push(rfq);
      }
      
      return res.json(createdRfqs.map(rfq => ({
        ...rfq,
        rawData: JSON.parse(rfq.rawData || '{}'),
        hasMatch: false,
        matchStatus: null
      })));
    }
    
    res.json(rfqs.map(rfq => ({
      ...rfq,
      rawData: JSON.parse(rfq.rawData || '{}'),
      hasMatch: rfq.matches.length > 0,
      matchStatus: rfq.matches[0]?.status || null,
      confidenceScore: rfq.matches[0]?.confidenceScore || null
    })));
  } catch (error) {
    console.error('Get RFQs error:', error);
    res.status(500).json({ error: 'Failed to get RFQs' });
  }
});

// Get single RFQ
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const rfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        matches: {
          where: { supplierId: req.supplierId },
          include: {
            catalogItem: true
          }
        }
      }
    });
    
    if (!rfq) {
      return res.status(404).json({ error: 'RFQ not found' });
    }
    
    res.json({
      ...rfq,
      rawData: JSON.parse(rfq.rawData || '{}'),
      matches: rfq.matches.map(m => ({
        ...m,
        catalogItem: m.catalogItem ? {
          ...m.catalogItem,
          keywords: JSON.parse(m.catalogItem.keywords || '[]'),
          categories: JSON.parse(m.catalogItem.categories || '[]'),
          skus: JSON.parse(m.catalogItem.skus || '[]')
        } : null
      }))
    });
  } catch (error) {
    console.error('Get RFQ error:', error);
    res.status(500).json({ error: 'Failed to get RFQ' });
  }
});

// Trigger RFQ scan (mock)
router.post('/scan', async (req: AuthRequest, res: Response) => {
  try {
    // In production, this would call Fairmarkit API
    // For demo, we just return success
    res.json({ 
      message: 'RFQ scan completed', 
      newRfqs: mockRfqs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Failed to scan RFQs' });
  }
});

export default router;
