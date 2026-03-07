import { Router, Response } from 'express';
import prisma from '../models/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get profile
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.supplierId },
      select: {
        id: true,
        email: true,
        companyName: true,
        notificationEmail: true,
        notificationTime: true,
        createdAt: true
      }
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(supplier);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update profile
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const { companyName, notificationEmail, notificationTime } = req.body;
    
    const supplier = await prisma.supplier.update({
      where: { id: req.supplierId },
      data: {
        companyName: companyName,
        notificationEmail: notificationEmail,
        notificationTime: notificationTime
      }
    });
    
    res.json({
      id: supplier.id,
      email: supplier.email,
      companyName: supplier.companyName,
      notificationEmail: supplier.notificationEmail,
      notificationTime: supplier.notificationTime
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
