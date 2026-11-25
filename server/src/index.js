import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initData, getDataBackend, users } from './data/index.js';
import { seedDatabase } from './utils/seed.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { setIO } from './utils/notificationService.js';
import authRoutes from './routes/authRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});
setIO(io);

io.on('connection', (socket) => {
  const userId = socket.handshake.auth?.userId;
  if (userId) socket.join(`user:${userId}`);
  socket.on('join', (id) => { if (id) socket.join(`user:${id}`); });
});

app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const uploadsDir = path.resolve(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'CivicTrack API', database: getDataBackend() || 'starting' })
);
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

initData().then(async () => {
  // A brand-new database has no accounts, and authority accounts can only be
  // provisioned by an existing superior — so demo data is seeded once. Set
  // SEED_DEMO_DATA=false to start with an empty database instead.
  if (process.env.SEED_DEMO_DATA !== 'false' && (await users.count()) === 0) {
    console.log(`Empty ${getDataBackend()} database — seeding demo data (set SEED_DEMO_DATA=false to skip).`);
    await seedDatabase({ disconnect: false, connect: false });
  }
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CivicTrack API running on http://localhost:${PORT} (${getDataBackend()} database)`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app, httpServer, io };
