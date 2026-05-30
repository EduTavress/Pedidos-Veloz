const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const { Pool } = require('pg');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3002;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
  database: process.env.DB_NAME || 'microservices'
});

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});
register.registerMetric(httpRequestDurationMicroseconds);

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'order-service', db: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'order-service', db: 'disconnected', error: error.message });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.get('/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { product_id, quantity, customer_id } = req.body;
    
    const productResponse = await axios.get(`${PRODUCT_SERVICE_URL}/products/${product_id}`);
    const product = productResponse.data;
    
    if (product.stock < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const total = product.price * quantity;
    
    const orderResult = await client.query(
      'INSERT INTO orders (product_id, quantity, customer_id, total, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [product_id, quantity, customer_id, total, 'pending']
    );
    const order = orderResult.rows[0];
    
    const paymentResponse = await axios.post(`${PAYMENT_SERVICE_URL}/payments`, {
      order_id: order.id,
      amount: order.total
    });
    
    const payment = paymentResponse.data;
    
    await client.query(
      'UPDATE orders SET payment_id = $1, status = $2 WHERE id = $3',
      [payment.id, payment.status === 'success' ? 'paid' : 'failed', order.id]
    );
    
    await client.query('COMMIT');
    
    const updatedOrder = await pool.query('SELECT * FROM orders WHERE id = $1', [order.id]);
    
    res.status(201).json(updatedOrder.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});
