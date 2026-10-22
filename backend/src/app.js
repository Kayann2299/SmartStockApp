import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './config/env.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import insightRoutes from './routes/insightRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { startBackgroundJobs } from './jobs/backgroundJobs.js';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const requestedPort = Number(process.env.PORT || 5000);
const port = Number.isNaN(requestedPort) ? 5000 : requestedPort;

app.use(cors());
app.use(express.json());

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'smartstock-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/saleshistory', salesRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

const startServer = () => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  }).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = port === 5000 ? 5001 : port + 1;
      console.warn(`Port ${port} is busy, trying ${fallbackPort} instead.`);
      app.listen(fallbackPort, () => {
        console.log(`Server running on port ${fallbackPort}`);
      });
      return;
    }

    console.error(error);
    process.exit(1);
  });
};

// Protege o servidor contra crashes causados por promises rejeitadas sem
// tratamento (ex.: uma chamada assíncrona sem try/catch) ou exceções não
// apanhadas (ex.: tentar responder a um pedido cujo cliente já fechou a
// ligação, o que pode acontecer em respostas mais lentas da IA). Sem isto,
// qualquer um destes casos derruba o processo Node inteiro.
process.on('unhandledRejection', (error) => {
  console.error('[server] unhandled rejection:', error);
});
process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception:', error);
});

startServer();
startBackgroundJobs();

