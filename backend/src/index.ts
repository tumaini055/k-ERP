import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import leadRoutes from './routes/leads';
import projectRoutes from './routes/projects';
import ticketRoutes from './routes/tickets';
import inventoryRoutes from './routes/inventory';
import financeRoutes from './routes/finance';
import employeeRoutes from './routes/employees';
import ispRoutes from './routes/isp';
import dashboardRoutes from './routes/dashboard';
import documentRoutes from './routes/documents';
import contractRoutes from './routes/contracts';
import eventRoutes from './routes/events';
import reportRoutes from './routes/reports';

const app = express();
const PORT = process.env.PORT || 5000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://k-erp.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/isp', ispRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`K-CONNECT API Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;
