const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Product = require('./models/Product');
const Sale = require('./models/Sale');
const Forecast = require('./models/Forecast');
const { forecastDemand } = require('./services/forecastingService');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/stocksense';

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected for Seeding...');

    // Clear existing collections
    await User.deleteMany();
    await Product.deleteMany();
    await Sale.deleteMany();
    await Forecast.deleteMany();

    console.log('Cleared existing data.');

    // 1. Create Demo Users
    const users = [
      {
        name: 'Admin User',
        email: 'admin@stocksense.ai',
        password: 'admin123',
        role: 'ADMIN',
      },
      {
        name: 'Manager User',
        email: 'manager@stocksense.ai',
        password: 'manager123',
        role: 'MANAGER',
      },
      {
        name: 'Staff Member',
        email: 'staff@stocksense.ai',
        password: 'staff123',
        role: 'STAFF',
      },
    ];

    for (const u of users) {
      await User.create(u);
    }
    console.log('Demo Users Created: Admin, Manager, Staff');

    // 2. Create Products
    const sampleProducts = [
      { name: 'Rice 5kg', category: 'Grocery', price: 350, stock: 25, reorderLevel: 10 },
      { name: 'Milk 1L', category: 'Dairy', price: 60, stock: 8, reorderLevel: 15 }, // Designed to be STOCKOUT_RISK
      { name: 'Sugar 1kg', category: 'Grocery', price: 45, stock: 40, reorderLevel: 10 },
      { name: 'Cooking Oil 1L', category: 'Grocery', price: 180, stock: 12, reorderLevel: 8 },
      { name: 'Wheat Flour 5kg', category: 'Grocery', price: 240, stock: 150, reorderLevel: 20 }, // Designed to be OVERSTOCK
      { name: 'Biscuits', category: 'Snacks', price: 30, stock: 50, reorderLevel: 15 },
      { name: 'Tea Powder 250g', category: 'Beverages', price: 140, stock: 35, reorderLevel: 10 },
      { name: 'Coffee 100g', category: 'Beverages', price: 210, stock: 18, reorderLevel: 8 },
      { name: 'Bath Soap', category: 'Personal Care', price: 40, stock: 60, reorderLevel: 12 },
      { name: 'Shampoo 200ml', category: 'Personal Care', price: 165, stock: 22, reorderLevel: 5 },
    ];

    const createdProducts = await Product.insertMany(sampleProducts);
    console.log(`Created ${createdProducts.length} Sample Products.`);

    // 3. Create Realistic Historical Sales over past 7 days
    const now = new Date();
    const salesToInsert = [];

    // Helper to generate past sales
    createdProducts.forEach((prod) => {
      let salesRates = [3, 4, 3, 5, 4, 3, 4]; // default
      if (prod.name === 'Milk 1L') {
        salesRates = [10, 14, 12, 15, 11, 13, 12]; // High demand -> stockout risk with stock=8
      } else if (prod.name === 'Wheat Flour 5kg') {
        salesRates = [1, 2, 1, 2, 1, 2, 1]; // Low demand -> overstock with stock=150
      } else if (prod.name === 'Rice 5kg') {
        salesRates = [3, 4, 3, 4, 3, 4, 3]; // Normal demand -> healthy with stock=25
      }

      salesRates.forEach((qty, idx) => {
        const saleDate = new Date(now);
        saleDate.setDate(now.getDate() - (7 - idx));

        salesToInsert.push({
          productId: prod._id,
          quantity: qty,
          totalAmount: qty * prod.price,
          date: saleDate,
        });
      });
    });

    await Sale.insertMany(salesToInsert);
    console.log(`Created ${salesToInsert.length} Historical Sales Records.`);

    // 4. Generate Initial Forecasts
    for (const prod of createdProducts) {
      const prodSales = salesToInsert.filter((s) => s.productId.toString() === prod._id.toString());
      const computed = forecastDemand(prodSales, prod.stock);

      await Forecast.create({
        productId: prod._id,
        forecastDailyDemand: computed.forecastDailyDemand,
        forecastWeeklyDemand: computed.forecastWeeklyDemand,
        currentStock: computed.currentStock,
        stockStatus: computed.stockStatus,
        recommendedReorderQuantity: computed.recommendedReorderQuantity,
        generatedAt: new Date(),
      });
    }

    console.log('Forecasts Generated & Saved.');
    console.log('✅ SEEDING COMPLETE SUCCESSFULLY!');
    return true;
  } catch (error) {
    console.error('Seeding Error:', error);
    if (require.main === module) process.exit(1);
    throw error;
  }
};

module.exports = seedData;

if (require.main === module) {
  seedData().then(() => process.exit(0));
}

