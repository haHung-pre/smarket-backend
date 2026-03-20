// routes/contact.js
const express = require('express');
const router  = express.Router();
const Contact = require('../models/Contact');
const { protect, restrictTo } = require('../middleware/auth');

// ============================================================
// POST /api/contact
// Public — submit contact message from Blogger frontend
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ: tên, email và nội dung tin nhắn.',
      });
    }

    const contact = await Contact.create({
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      phone:   phone ? phone.trim() : '',
      message: message.trim(),
      ip:      req.ip || req.headers['x-forwarded-for'] || '',
    });

    res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn đã liên hệ! Hà Hùng sẽ phản hồi trong thời gian sớm nhất.',
      contactId: contact._id,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại sau.' });
  }
});

// ============================================================
// GET /api/contact
// Admin only — list messages
// ============================================================
router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Contact.countDocuments(filter);

    const contacts = await Contact
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      contacts,
      pagination: { total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// GET /api/contact/:id
// Admin only — single message
// ============================================================
router.get('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'read' } },
      { new: true }
    );
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Tin nhắn không tìm thấy.' });
    }
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// PATCH /api/contact/:id/status
// Admin only — update status
// ============================================================
router.patch('/:id/status', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const update = {};
    if (status)    update.status    = status;
    if (adminNote) update.adminNote = adminNote;

    const contact = await Contact.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// DELETE /api/contact/:id
// Admin only
// ============================================================
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Tin nhắn đã được xóa.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
