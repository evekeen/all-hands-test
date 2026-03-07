import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../models/db';
import { generateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, companyName, notificationEmail } = req.body;
    
    if (!email || !password || !companyName) {
      return res.status(400).json({ error: 'Email, password, and company name are required' });
    }
    
    const existingSupplier = await prisma.supplier.findUnique({ where: { email } });
    if (existingSupplier) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const supplier = await prisma.supplier.create({
      data: {
        email,
        password: hashedPassword,
        companyName,
        notificationEmail: notificationEmail || email
      }
    });
    
    const token = generateToken(supplier.id);
    
    res.status(201).json({
      token,
      supplier: {
        id: supplier.id,
        email: supplier.email,
        companyName: supplier.companyName
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const supplier = await prisma.supplier.findUnique({ where: { email } });
    if (!supplier) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, supplier.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(supplier.id);
    
    res.json({
      token,
      supplier: {
        id: supplier.id,
        email: supplier.email,
        companyName: supplier.companyName,
        notificationEmail: supplier.notificationEmail,
        notificationTime: supplier.notificationTime
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req: AuthRequest, res: Response) => {
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
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
