import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleStatusCallback, handleTestCallback } from './route/shipping/ghn-webhook.ts';
import { syncGHNOrders, cancelOrder } from './route/shipping/ghn-sync.ts';
import { handlePaymentIPN, handlePaymentReturn } from './route/payment/vnpay-callback.ts';
import vnpayRouter from './route/payment/vnpay.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.send('API is running');
});

// VNPay routes
app.use('/api/payment/vnpay', vnpayRouter);
app.post('/api/payment/vnpay-ipn', handlePaymentIPN);
app.get('/api/payment/vnpay-return', handlePaymentReturn);

// GHN webhook routes
app.post('/api/shipping/ghn-webhook', handleStatusCallback);
app.post('/api/shipping/ghn-test', handleTestCallback);

// GHN sync routes
app.post('/api/shipping/ghn-sync', syncGHNOrders);
app.post('/api/shipping/cancel-order/:orderId', cancelOrder);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app; 