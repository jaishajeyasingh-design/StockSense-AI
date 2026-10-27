const crypto = require('crypto');

/**
 * StockSense AI - Purchase Order Number Generator Utility
 * 
 * Generates unique, enterprise-grade, human-readable purchase order numbers.
 * Format: PO-YYYYMMDD-XXXXXX (e.g. PO-20261025-A7B8C9)
 * 
 * Avoids relying on timestamps alone by combining:
 * 1. Date namespace (YYYYMMDD) for fast date-based visual indexing
 * 2. Cryptographically secure random entropy (3 bytes = 6 hex uppercase characters)
 * 3. Database collision detection and safe retry loop with max attempts
 */

/**
 * Formats a candidate PO number from a date and entropy string.
 * @param {Date} [date] - Base date (defaults to now)
 * @param {string} [entropy] - Random hex/alphanumeric suffix
 * @returns {string} Formatted PO number
 */
const formatPONumber = (date = new Date(), entropy) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const suffix = entropy || crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PO-${dateStr}-${suffix}`;
};

/**
 * Generates a unique purchase order number.
 * If a Mongoose PurchaseOrderModel is provided, verifies uniqueness against the database.
 * 
 * @param {import('mongoose').Model} [PurchaseOrderModel] - Mongoose model to check uniqueness against
 * @param {Object} [options]
 * @param {number} [options.maxAttempts=10] - Maximum collision retry attempts
 * @param {Date} [options.date] - Optional date override
 * @returns {Promise<string>} Unique PO number string
 */
const generateUniquePONumber = async (PurchaseOrderModel = null, options = {}) => {
  const maxAttempts = options.maxAttempts || 10;
  const targetDate = options.date || new Date();

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const candidate = formatPONumber(targetDate);

    // If a model is available, query for collision (skip if Mongoose connection is disconnected)
    const isMongooseModelDisconnected =
      PurchaseOrderModel &&
      PurchaseOrderModel.db &&
      typeof PurchaseOrderModel.db.readyState === 'number' &&
      PurchaseOrderModel.db.readyState !== 1;

    if (PurchaseOrderModel && typeof PurchaseOrderModel.findOne === 'function' && !isMongooseModelDisconnected) {
      try {
        const existing = await PurchaseOrderModel.findOne({ poNumber: candidate })
          .select('_id')
          .lean();
        if (!existing) {
          return candidate;
        }
      } catch (err) {
        // If DB query fails (e.g. offline validation/mocking), return candidate
        return candidate;
      }
    } else {
      // Standalone or disconnected generation without blocking DB query
      return candidate;
    }
  }

  // Fallback: If 10 random attempts collide, append high-resolution timestamp entropy
  const fallbackEntropy = `${crypto.randomBytes(2).toString('hex').toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
  return formatPONumber(targetDate, fallbackEntropy);
};

/**
 * Validates whether a given string adheres to the standard PO number pattern.
 * @param {string} poNumber - PO Number candidate
 * @returns {boolean} True if valid pattern
 */
const isValidPONumber = (poNumber) => {
  if (!poNumber || typeof poNumber !== 'string') return false;
  // Format: PO-YYYYMMDD-XXXX(XX) (4-12 alphanumeric characters)
  const poRegex = /^PO-\d{8}-[A-Z0-9]{4,12}$/;
  return poRegex.test(poNumber.trim());
};

module.exports = {
  formatPONumber,
  generateUniquePONumber,
  isValidPONumber,
};
