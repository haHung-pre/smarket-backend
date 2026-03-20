// server.js — S Market Backend
// Owner: Hà Hùng
// ============================================================
require('dotenv').config();

const express     = require('express');
const mongoose    = require('mongoose');
const cors        = require('cors');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const productRoutes = require('./routes/products');
const contactRoutes = require('./routes/contact');
const authRoutes    = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// DATABASE CONNECTION
// ============================================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    seedAdminUser();          // create default admin if needed
  })
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS — allow Blogger frontend + localhost
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (Postman, curl, same-origin)
      if (!origin) return cb(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /\.blogspot\.com$/.test(origin) ||
        /localhost/.test(origin)
      ) {
        return cb(null, true);
      }
      cb(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      200,
  message:  { success: false, message: 'Quá nhiều yêu cầu. Thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      5,
  message:  { success: false, message: 'Bạn đã gửi quá nhiều tin nhắn. Thử lại sau 1 giờ.' },
});

app.use('/api/', apiLimiter);

// Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ============================================================
// ROUTES
// ============================================================
app.use('/api/products', productRoutes);
app.use('/api/contact',  contactLimiter, contactRoutes);
app.use('/api/auth',     authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success:  true,
    status:   'OK',
    service:  'S Market API — Hà Hùng',
    version:  '1.0.0',
    dbState:  mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time:     new Date().toISOString(),
  });
});

// Root redirect to admin
app.get('/', (req, res) => res.redirect('/admin'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} không tìm thấy.` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Lỗi server nội bộ.' : err.message,
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀  S Market API is running on port ${PORT}`);
  console.log(`   Admin panel : http://localhost:${PORT}/admin`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Products    : http://localhost:${PORT}/api/products`);
  console.log(`   Owner       : Hà Hùng\n`);
});

// ============================================================
// SEED: Create default admin if none exists
// ============================================================
async function seedAdminUser() {
  try {
    const User = require('./models/User');
    const email    = process.env.ADMIN_EMAIL    || 'admin@smarket.vn';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const name     = process.env.ADMIN_NAME     || 'Hà Hùng';

    // Always delete and recreate admin to ensure password is in sync
    await User.deleteMany({ role: 'admin' });
    await User.create({ name, email, password, role: 'admin' });

    console.log('👤  Admin account ready:');
    console.log(`    Email   : ${email}`);
    console.log(`    Password: ${password}`);
    console.log('    ✅  Login at /admin');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

module.exports = app;
