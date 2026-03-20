// routes/products.js
const express   = require('express');
const router    = express.Router();
const Product   = require('../models/Product');
const { protect, restrictTo } = require('../middleware/auth');

// ============================================================
// GET /api/products
// Public — list products with filter, pagination, search
// ============================================================
router.get('/', async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 12,
      category,
      featured,
      search,
      sort     = '-createdAt',
      minPrice,
      maxPrice,
    } = req.query;

    // Build filter
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (featured)  filter.featured = featured === 'true';
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const products = await Product
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      products,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// GET /api/products/:id
// Public — single product
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { slug: req.params.id },
      ],
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tìm thấy.' });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// POST /api/products
// Admin only — create product
// ============================================================
router.post('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Slug đã tồn tại.' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// PUT /api/products/:id
// Admin only — update product
// ============================================================
router.put('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tìm thấy.' });
    }
    res.json({ success: true, product });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// DELETE /api/products/:id
// Admin only — soft delete (set isActive = false)
// ============================================================
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tìm thấy.' });
    }
    res.json({ success: true, message: 'Sản phẩm đã được xóa (ẩn) thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// DELETE /api/products/:id/hard
// Admin only — permanent delete
// ============================================================
router.delete('/:id/hard', protect, restrictTo('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sản phẩm đã bị xóa vĩnh viễn.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
