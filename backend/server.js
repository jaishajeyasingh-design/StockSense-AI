const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to Database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

// Body parser & CORS
app.use(cors());
app.use(express.json());

// Import Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const salesRoutes = require('./routes/salesRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);

// Import Middleware
const { protect, authorize } = require('./middleware/authMiddleware');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'StockSense AI Backend API is running smoothly' });
});

// Seed API endpoint for easy review demo triggering (Protected: ADMIN only)
app.post('/api/seed', protect, authorize('ADMIN'), async (req, res) => {
  try {
    const seedData = require('./seed');
    await seedData();
    res.json({ success: true, message: 'Seeding completed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} Not Found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 StockSense AI Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  process.on('unhandledRejection', (err) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
  });
}
