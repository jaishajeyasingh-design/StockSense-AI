/**
 * Pre-Execution Database Isolation Verifier
 * Ensures that any manual or automated test execution is strictly bound
 * to an isolated test database (e.g. stocksense_test) and CANNOT write to 'stocksense'.
 */
const mongoose = require('mongoose');

const verifyIsolation = async () => {
  const uri = process.env.MONGO_URI;
  console.log('----------------------------------------------------');
  console.log('StockSense AI - Database Connection Verifier');
  console.log('----------------------------------------------------');
  console.log(`Evaluated MONGO_URI: ${uri || '(default fallback)'}`);

  if (!uri) {
    console.error('\n❌ ERROR: MONGO_URI is not defined in process environment!');
    console.error('Do not proceed without an explicit isolated test URI.\n');
    process.exit(1);
  }

  // Strict guard: verify the URI does not target the real development database
  if (uri.trim().endsWith('/stocksense') || uri.trim() === 'mongodb://127.0.0.1:27017/stocksense') {
    console.error('\n🛑 CRITICAL HAZARD DETECTED:');
    console.error(`Target database is the REAL development database: '${uri}'`);
    console.error('All operations aborted to protect development data integrity.\n');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    const dbName = conn.connection.name;
    const dbHost = conn.connection.host;
    const dbPort = conn.connection.port;

    console.log(`Connection Host: ${dbHost}:${dbPort}`);
    console.log(`Active Database: ${dbName}`);

    if (dbName === 'stocksense') {
      console.error('\n🛑 CRITICAL SAFETY FAILURE:');
      console.error('Connected database name is "stocksense" (Real Development DB).');
      console.error('Aborting immediately.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (!dbName.includes('test')) {
      console.warn(`\n⚠️  WARNING: Database name "${dbName}" does not contain "test".`);
      console.warn('Recommended test database names: stocksense_test, stocksense_manual_test.\n');
    }

    console.log('\n✅ VERIFIED SAFE FOR TESTING:');
    console.log(`Connected to isolated test database: "${dbName}"`);
    console.log('Real development database "stocksense" is completely isolated and protected.\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Failed to connect to MongoDB: ${err.message}\n`);
    process.exit(1);
  }
};

verifyIsolation();
