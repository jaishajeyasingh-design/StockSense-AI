/**
 * Dedicated Test Database Seeder
 * Populates ONLY the isolated 'stocksense_test' database with baseline test accounts and products.
 *
 * SAFETY INVARIANT: Refuses to execute if the connected database is 'stocksense'
 * or does not contain 'test' in its database name.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const seedTestDbOnly = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.trim().endsWith('/stocksense') || uri.trim() === 'mongodb://127.0.0.1:27017/stocksense') {
    console.error('🛑 SAFETY REFUSAL: Target database is the production/development database.');
    console.error('This script can only be run against a database ending with _test.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    const dbName = conn.connection.name;

    if (dbName === 'stocksense' || !dbName.includes('test')) {
      console.error(`🛑 SAFETY REFUSAL: Connected database "${dbName}" is not an isolated test database.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`\nInitializing isolated test database: "${dbName}" on ${conn.connection.host}...`);

    const User = require('../models/User');
    const Product = require('../models/Product');
    const PurchaseOrder = require('../models/PurchaseOrder');

    // Clean only the test database
    await User.deleteMany({});
    await Product.deleteMany({});
    await PurchaseOrder.deleteMany({});

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Test1234!', salt);

    // Create baseline test accounts
    const testAdmin = await User.create({
      name: 'Test Admin',
      email: 'admin.test@stocksense.ai',
      password: passwordHash,
      role: 'ADMIN',
    });

    const testManager = await User.create({
      name: 'Test Manager',
      email: 'manager.test@stocksense.ai',
      password: passwordHash,
      role: 'MANAGER',
    });

    const testStaff = await User.create({
      name: 'Test Staff',
      email: 'staff.test@stocksense.ai',
      password: passwordHash,
      role: 'STAFF',
    });

    // Create baseline test products with known stock
    const testProduct1 = await Product.create({
      name: 'Industrial Valve X1 (Test Item)',
      sku: 'TEST-VALVE-X1',
      category: 'Plumbing',
      price: 25.0,
      stock: 50,
      reorderLevel: 20,
    });

    const testProduct2 = await Product.create({
      name: 'Hydraulic Seal 50mm (Test Item)',
      sku: 'TEST-SEAL-50',
      category: 'Mechanical',
      price: 8.5,
      stock: 15,
      reorderLevel: 30,
    });

    console.log('✅ Isolated test database populated successfully:');
    console.log(`   - Admin Account:   ${testAdmin.email} (Password: Test1234!)`);
    console.log(`   - Manager Account: ${testManager.email} (Password: Test1234!)`);
    console.log(`   - Staff Account:   ${testStaff.email} (Password: Test1234!)`);
    console.log(`   - Products:        ${testProduct1.name} (Stock: 50), ${testProduct2.name} (Stock: 15)`);
    console.log('\nReal development database "stocksense" was NOT touched.\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err.message);
    process.exit(1);
  }
};

seedTestDbOnly();
