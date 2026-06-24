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
import settingsRoutes from './routes/settings';
import attendanceRoutes from './routes/attendance';
import companyStructureRoutes from './routes/company-structure';
import supabase from './config/supabase';

const app = express();
const PORT = process.env.PORT || 5000;

supabase.storage.getBucket('documents').catch(() => {
  supabase.storage.createBucket('documents', { public: true, fileSizeLimit: 52428800 });
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://k-erp.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const apiPrefix = process.env.VERCEL ? '' : '/api';

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/customers`, customerRoutes);
app.use(`${apiPrefix}/leads`, leadRoutes);
app.use(`${apiPrefix}/projects`, projectRoutes);
app.use(`${apiPrefix}/tickets`, ticketRoutes);
app.use(`${apiPrefix}/inventory`, inventoryRoutes);
app.use(`${apiPrefix}/finance`, financeRoutes);
app.use(`${apiPrefix}/employees`, employeeRoutes);
app.use(`${apiPrefix}/isp`, ispRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/documents`, documentRoutes);
app.use(`${apiPrefix}/contracts`, contractRoutes);
app.use(`${apiPrefix}/events`, eventRoutes);
app.use(`${apiPrefix}/reports`, reportRoutes);
app.use(`${apiPrefix}/settings`, settingsRoutes);
app.use(`${apiPrefix}/attendance`, attendanceRoutes);
app.use(`${apiPrefix}/company`, companyStructureRoutes);

app.get(`${apiPrefix}/health`, (_req, res) => {
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
