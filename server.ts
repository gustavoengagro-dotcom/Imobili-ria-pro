import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': ASAAS_API_KEY,
    'Content-Type': 'application/json',
  },
});

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Asaas Proxy Routes
  app.post('/api/asaas/customers', async (req, res) => {
    try {
      if (!ASAAS_API_KEY) {
        return res.status(500).json({ error: 'ASAAS_API_KEY not configured' });
      }
      const response = await asaasClient.post('/customers', req.body);
      res.json(response.data);
    } catch (error: any) {
      console.error('Asaas Customer Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
  });

  app.post('/api/asaas/payments', async (req, res) => {
    try {
      if (!ASAAS_API_KEY) {
        return res.status(500).json({ error: 'ASAAS_API_KEY not configured' });
      }
      const response = await asaasClient.post('/payments', req.body);
      res.json(response.data);
    } catch (error: any) {
      console.error('Asaas Payment Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
  });

  app.get('/api/asaas/payments/:id', async (req, res) => {
    try {
      if (!ASAAS_API_KEY) {
        return res.status(500).json({ error: 'ASAAS_API_KEY not configured' });
      }
      const response = await asaasClient.get(`/payments/${req.params.id}`);
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
  });

  app.get('/api/asaas/payments/:id/identificationField', async (req, res) => {
    try {
      if (!ASAAS_API_KEY) {
        return res.status(500).json({ error: 'ASAAS_API_KEY not configured' });
      }
      const response = await asaasClient.get(`/payments/${req.params.id}/identificationField`);
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
  });

  app.get('/api/asaas/payments/:id/pixQrCode', async (req, res) => {
    try {
      if (!ASAAS_API_KEY) {
        return res.status(500).json({ error: 'ASAAS_API_KEY not configured' });
      }
      const response = await asaasClient.get(`/payments/${req.params.id}/pixQrCode`);
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
  });

  app.get('/api/asaas/test', async (req, res) => {
    try {
      if (!ASAAS_API_KEY) {
        return res.status(500).json({ error: 'ASAAS_API_KEY not configured' });
      }
      const response = await asaasClient.get('/myAccount');
      res.json({ status: 'ok', name: response.data.name });
    } catch (error: any) {
      console.error('Asaas Test Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
