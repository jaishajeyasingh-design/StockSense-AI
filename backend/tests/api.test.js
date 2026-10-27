const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');

// Ensure test environment is explicitly set before importing app and models
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'stocksense_test_secret_key_2026';
const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/stocksense_test';

const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Forecast = require('../models/Forecast');

describe('StockSense AI RBAC & Security Test Suite (Isolated DB)', () => {
  let adminToken = '';
  let managerToken = '';
  let staffToken = '';
  let testProductId = '';

  before(async () => {
    // Connect to isolated test database
    await mongoose.connect(TEST_MONGO_URI);

    // Clean test database collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Sale.deleteMany({});
    await Forecast.deleteMany({});

    // Seed test users for each role
    await User.create({
      name: 'Test Admin',
      email: 'admin_test@stocksense.ai',
      password: 'admin123',
      role: 'ADMIN',
    });

    await User.create({
      name: 'Test Manager',
      email: 'manager_test@stocksense.ai',
      password: 'manager123',
      role: 'MANAGER',
    });

    await User.create({
      name: 'Test Staff',
      email: 'staff_test@stocksense.ai',
      password: 'staff123',
      role: 'STAFF',
    });

    // Seed test product
    const prod = await Product.create({
      name: 'Isolated Test Product',
      category: 'Grocery',
      price: 150,
      stock: 10,
      reorderLevel: 5,
    });
    testProductId = prod._id.toString();

    // Authenticate each test user to obtain tokens
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin_test@stocksense.ai', password: 'admin123' });
    adminToken = adminLoginRes.body.data.token;

    const managerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager_test@stocksense.ai', password: 'manager123' });
    managerToken = managerLoginRes.body.data.token;

    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff_test@stocksense.ai', password: 'staff123' });
    staffToken = staffLoginRes.body.data.token;
  });

  after(async () => {
    // Clean up isolated test collections and disconnect cleanly
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Product.deleteMany({});
      await Sale.deleteMany({});
      await Forecast.deleteMany({});
      await mongoose.disconnect();
    }
  });

  // A. Public Registration & Privilege Escalation Prevention
  describe('A. Registration & Privilege Escalation', () => {
    it('Public registration must assign STAFF role even if ADMIN role is requested', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hacker User',
          email: 'hacker@stocksense.ai',
          password: 'password123',
          role: 'ADMIN',
        });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.role, 'STAFF', 'Role must be forced to STAFF for public registration');

      // Verify in database directly
      const savedUser = await User.findOne({ email: 'hacker@stocksense.ai' });
      assert.strictEqual(savedUser.role, 'STAFF');
    });

    it('Public registration must assign STAFF role if MANAGER role is requested', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Manager Wannabe',
          email: 'wannabe@stocksense.ai',
          password: 'password123',
          role: 'MANAGER',
        });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.role, 'STAFF');
    });
  });

  // B. Seed Endpoint Authorization
  describe('B. Seed Endpoint Protection', () => {
    it('POST /api/seed without token should return 401', async () => {
      const res = await request(app).post('/api/seed');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/seed with STAFF token should return 403', async () => {
      const res = await request(app)
        .post('/api/seed')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/seed with MANAGER token should return 403', async () => {
      const res = await request(app)
        .post('/api/seed')
        .set('Authorization', `Bearer ${managerToken}`);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });
  });

  // C. Product Retrieval & CRUD Authorization
  describe('C. Product Routes Authorization', () => {
    it('GET /api/products without token should return 401', async () => {
      const res = await request(app).get('/api/products');
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/products/:id without token should return 401', async () => {
      const res = await request(app).get(`/api/products/${testProductId}`);
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/products with STAFF token should succeed (200)', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    it('POST /api/products as STAFF should return 403', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Denied Product', category: 'Grocery', price: 10, stock: 5 });
      assert.strictEqual(res.status, 403);
    });

    it('POST /api/products as MANAGER should succeed (201)', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Manager Product', category: 'Grocery', price: 100, stock: 20 });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
    });

    it('DELETE /api/products/:id as MANAGER should return 403 (Admin only)', async () => {
      const res = await request(app)
        .delete(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      assert.strictEqual(res.status, 403);
    });
  });

  // D. Sales History & Sales Recording Authorization
  describe('D. Sales Routes Authorization', () => {
    it('GET /api/sales without token should return 401', async () => {
      const res = await request(app).get('/api/sales');
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/sales as STAFF should return 403', async () => {
      const res = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('GET /api/sales as MANAGER should succeed (200)', async () => {
      const res = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${managerToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    it('POST /api/sales with insufficient stock should return 400', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ productId: testProductId, quantity: 9999 });
      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /insufficient stock/i);
    });

    it('POST /api/sales as STAFF with valid stock should succeed (201)', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ productId: testProductId, quantity: 1 });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
    });
  });

  // E. Forecasting Authorization & Route Ordering
  describe('E. Forecast Routes Authorization', () => {
    it('GET /api/forecast/:productId without token should return 401', async () => {
      const res = await request(app).get(`/api/forecast/${testProductId}`);
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/forecast/:productId as STAFF should return 403', async () => {
      const res = await request(app)
        .get(`/api/forecast/${testProductId}`)
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('POST /api/forecast/generate-all as STAFF should return 403', async () => {
      const res = await request(app)
        .post('/api/forecast/generate-all')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('GET /api/forecast/:productId as MANAGER should succeed (200)', async () => {
      const res = await request(app)
        .get(`/api/forecast/${testProductId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    it('POST /api/forecast/generate-all as MANAGER should succeed (200)', async () => {
      const res = await request(app)
        .post('/api/forecast/generate-all')
        .set('Authorization', `Bearer ${managerToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(typeof res.body.count, 'number');
    });
  });

  // F. Dashboard Authorization
  describe('F. Dashboard Route Authorization', () => {
    it('GET /api/dashboard without token should return 401', async () => {
      const res = await request(app).get('/api/dashboard');
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/dashboard as STAFF should return 403', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('GET /api/dashboard as MANAGER should succeed (200)', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${managerToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.summary);
    });

    it('GET /api/dashboard as ADMIN should succeed (200)', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });
  });

  // G. Health & Authentication Baseline
  describe('G. Health & Auth Endpoints', () => {
    it('GET /api/health should remain public (200)', async () => {
      const res = await request(app).get('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    it('POST /api/auth/login should remain public (200 on valid, 401 on invalid)', async () => {
      const validRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin_test@stocksense.ai', password: 'admin123' });
      assert.strictEqual(validRes.status, 200);

      const invalidRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin_test@stocksense.ai', password: 'wrong' });
      assert.strictEqual(invalidRes.status, 401);
    });

    it('GET /api/auth/me should require authentication', async () => {
      const unauth = await request(app).get('/api/auth/me');
      assert.strictEqual(unauth.status, 401);

      const auth = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(auth.status, 200);
      assert.strictEqual(auth.body.data.email, 'admin_test@stocksense.ai');
    });
  });
});
