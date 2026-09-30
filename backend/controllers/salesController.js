const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Forecast = require('../models/Forecast');
const { forecastDemand } = require('../services/forecastingService');

// @desc    Record a new sale & reduce inventory stock
// @route   POST /api/sales
// @access  Private (ADMIN, MANAGER, STAFF)
const createSale = async (req, res) => {
  try {
    const { productId, quantity, date } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide valid productId and positive quantity' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock! Requested: ${quantity}, Available: ${product.stock}`,
      });
    }

    const totalAmount = product.price * Number(quantity);

    // Create Sale record
    const sale = await Sale.create({
      productId,
      quantity: Number(quantity),
      totalAmount,
      date: date ? new Date(date) : new Date(),
    });

    // Reduce product stock
    product.stock -= Number(quantity);
    await product.save();

    // Recalculate forecast for this product to keep analytics fresh
    const salesHistory = await Sale.find({ productId });
    const forecastResult = forecastDemand(salesHistory, product.stock);

    await Forecast.findOneAndUpdate(
      { productId },
      {
        productId,
        forecastDailyDemand: forecastResult.forecastDailyDemand,
        forecastWeeklyDemand: forecastResult.forecastWeeklyDemand,
        currentStock: forecastResult.currentStock,
        stockStatus: forecastResult.stockStatus,
        recommendedReorderQuantity: forecastResult.recommendedReorderQuantity,
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully',
      data: {
        sale,
        remainingStock: product.stock,
      },
    });
  } catch (error) {
    console.error('createSale error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// @desc    Get all sales history
// @route   GET /api/sales
// @access  Public / Private
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate('productId', 'name category price stock')
      .sort({ date: -1 });

    res.json({ success: true, count: sales.length, data: sales });
  } catch (error) {
    console.error('getSales error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// @desc    Get sales history for a specific product
// @route   GET /api/sales/product/:productId
// @access  Public / Private
const getSalesByProduct = async (req, res) => {
  try {
    const sales = await Sale.find({ productId: req.params.productId })
      .populate('productId', 'name price stock')
      .sort({ date: -1 });

    res.json({ success: true, count: sales.length, data: sales });
  } catch (error) {
    console.error('getSalesByProduct error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

module.exports = {
  createSale,
  getSales,
  getSalesByProduct,
};
