import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import supplierRoutes from './routes/suppliers';
import catalogRoutes from './routes/catalog';
import rfqRoutes from './routes/rfqs';
import matchRoutes from './routes/matches';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/rfqs', rfqRoutes);
app.use('/api/matches', matchRoutes);

// Serve static files
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
