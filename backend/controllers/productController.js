const Product = require('../models/Product');
const Forecast = require('../models/Forecast');

// @desc    Get all products (with optional search and category filter)
// @route   GET /api/products
// @access  Public / Private
const getProducts = async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category && category !== 'All') {
      query.category = category;
    }

    const products = await Product.find(query).sort({ createdAt: -1 });

    // Fetch latest forecasts to attach dynamic status if present
    const forecasts = await Forecast.find();
    const forecastMap = {};
    forecasts.forEach((f) => {
      forecastMap[f.productId.toString()] = f;
    });

    const enrichedProducts = products.map((p) => {
      const pObj = p.toObject();
      const f = forecastMap[p._id.toString()];
      if (f) {
        pObj.calculatedStatus = f.stockStatus;
        pObj.forecastWeeklyDemand = f.forecastWeeklyDemand;
        pObj.recommendedReorderQuantity = f.recommendedReorderQuantity;
      } else {
        // Fallback status logic
        if (pObj.stock <= pObj.reorderLevel) {
          pObj.calculatedStatus = 'STOCKOUT_RISK';
        } else if (pObj.stock > pObj.reorderLevel * 4) {
          pObj.calculatedStatus = 'OVERSTOCK';
        } else {
          pObj.calculatedStatus = 'HEALTHY';
        }
      }
      return pObj;
    });

    res.json({ success: true, count: enrichedProducts.length, data: enrichedProducts });
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public / Private
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('getProductById error:', error);
    res.status(500).json({ success: false, message: 'Invalid product ID or Server Error' });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (ADMIN / MANAGER)
const createProduct = async (req, res) => {
  try {
    const { name, category, price, stock, reorderLevel } = req.body;

    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const product = await Product.create({
      name,
      category,
      price: Number(price),
      stock: Number(stock),
      reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : 10,
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (ADMIN / MANAGER)
const updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (ADMIN)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
