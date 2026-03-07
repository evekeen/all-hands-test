import { Router, Response } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import prisma from '../models/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authMiddleware);

// Get all catalog items
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.catalogItem.findMany({
      where: { supplierId: req.supplierId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Parse JSON strings back to arrays
    const parsedItems = items.map(item => ({
      ...item,
      keywords: JSON.parse(item.keywords || '[]'),
      categories: JSON.parse(item.categories || '[]'),
      skus: JSON.parse(item.skus || '[]')
    }));
    
    res.json(parsedItems);
  } catch (error) {
    console.error('Get catalog error:', error);
    res.status(500).json({ error: 'Failed to get catalog' });
  }
});

// Upload CSV catalog
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const supplierId = req.supplierId!;
    const csvData = req.file.buffer.toString('utf-8');
    
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });
    
    if (parsed.errors.length > 0) {
      return res.status(400).json({ 
        error: 'CSV parsing error', 
        details: parsed.errors 
      });
    }
    
    const rows = parsed.data as any[];
    
    // Clear existing catalog items
    await prisma.catalogItem.deleteMany({
      where: { supplierId }
    });
    
    // Insert new items
    const createdItems = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Map CSV columns flexibly
      const name = row.name || row.product_name || row.product || row.item_name || row.Item || row.Product || 'Unnamed Item';
      const keywords = row.keywords || row.keyword || row.tags || row.Tags || row.keywords || '';
      const categories = row.category || row.categories || row.type || row.Type || '';
      const skus = row.sku || row.skus || row.SKU || row.SKUs || '';
      
      const item = await prisma.catalogItem.create({
        data: {
          supplierId,
          name,
          keywords: JSON.stringify(keywords.split(',').map((k: string) => k.trim()).filter(Boolean)),
          categories: JSON.stringify(categories.split(',').map((c: string) => c.trim()).filter(Boolean)),
          skus: JSON.stringify(skus.split(',').map((s: string) => s.trim()).filter(Boolean)),
          csvRow: i + 2 // +2 because header is row 1, data starts at row 2
        }
      });
      
      createdItems.push({
        ...item,
        keywords: JSON.parse(item.keywords),
        categories: JSON.parse(item.categories),
        skus: JSON.parse(item.skus)
      });
    }
    
    res.json({ 
      message: `Successfully uploaded ${createdItems.length} catalog items`,
      items: createdItems
    });
  } catch (error) {
    console.error('Upload catalog error:', error);
    res.status(500).json({ error: 'Failed to upload catalog' });
  }
});

// Add single catalog item
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const supplierId = req.supplierId!;
    const { name, keywords, categories, skus } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const item = await prisma.catalogItem.create({
      data: {
        supplierId,
        name,
        keywords: JSON.stringify(keywords || []),
        categories: JSON.stringify(categories || []),
        skus: JSON.stringify(skus || [])
      }
    });
    
    res.status(201).json({
      ...item,
      keywords: JSON.parse(item.keywords),
      categories: JSON.parse(item.categories),
      skus: JSON.parse(item.skus)
    });
  } catch (error) {
    console.error('Add catalog item error:', error);
    res.status(500).json({ error: 'Failed to add catalog item' });
  }
});

// Update catalog item
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, keywords, categories, skus } = req.body;
    
    // Verify ownership
    const existing = await prisma.catalogItem.findFirst({
      where: { id, supplierId: req.supplierId }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }
    
    const item = await prisma.catalogItem.update({
      where: { id },
      data: {
        name: name || existing.name,
        keywords: keywords ? JSON.stringify(keywords) : existing.keywords,
        categories: categories ? JSON.stringify(categories) : existing.categories,
        skus: skus ? JSON.stringify(skus) : existing.skus
      }
    });
    
    res.json({
      ...item,
      keywords: JSON.parse(item.keywords),
      categories: JSON.parse(item.categories),
      skus: JSON.parse(item.skus)
    });
  } catch (error) {
    console.error('Update catalog item error:', error);
    res.status(500).json({ error: 'Failed to update catalog item' });
  }
});

// Delete catalog item
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existing = await prisma.catalogItem.findFirst({
      where: { id, supplierId: req.supplierId }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }
    
    await prisma.catalogItem.delete({ where: { id } });
    
    res.json({ message: 'Catalog item deleted' });
  } catch (error) {
    console.error('Delete catalog item error:', error);
    res.status(500).json({ error: 'Failed to delete catalog item' });
  }
});

// Clear all catalog items
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.catalogItem.deleteMany({
      where: { supplierId: req.supplierId }
    });
    
    res.json({ message: 'All catalog items deleted' });
  } catch (error) {
    console.error('Clear catalog error:', error);
    res.status(500).json({ error: 'Failed to clear catalog' });
  }
});

export default router;
