const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const auth = require('../middleware/auth');

// =============================================
// POST /api/auth/register - สมัครสมาชิก
// =============================================
router.post('/register', async (req, res) => {
  const { username, email, password, full_name, phone } = req.body;

  // Validation BEFORE acquiring connection
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกข้อมูลให้ครบ (username, email, password)'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    });
  }

  // Check existing user (before transaction to avoid unnecessary connection hold)
  const [existing] = await pool.query(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [email, username]
  );

  if (existing.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'Email หรือ Username นี้ถูกใช้แล้ว'
    });
  }

  // ✅ FIX BUG-09: Use transaction — user + card creation must be atomic
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await conn.query(
      'INSERT INTO users (username, email, password, full_name, phone) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, full_name || null, phone || null]
    );

    // ✅ FIX BUG-08: Generate unique card number (retry if collision)
    const cardNumber = await generateUniqueCardNumber(conn);
    await conn.query(
      'INSERT INTO cards (user_id, card_number, card_name, balance, issued_date, expiry_date) VALUES (?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 YEAR))',
      [result.insertId, cardNumber, 'Rabbit Card', 0.00]
    );

    await conn.commit();

    // Generate JWT (outside transaction — not DB dependent)
    const token = jwt.sign(
      { id: result.insertId, username, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      data: {
        token,
        user: {
          id: result.insertId,
          username,
          email,
          full_name: full_name || null
        }
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Register Error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  } finally {
    conn.release();
  }
});

// =============================================
// POST /api/auth/login - เข้าสู่ระบบ
// =============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก Email และ Password'
      });
    }

    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email หรือ Password ไม่ถูกต้อง'
      });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email หรือ Password ไม่ถูกต้อง'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          avatar_url: user.avatar_url
        }
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

// =============================================
// GET /api/auth/me - ข้อมูล User ปัจจุบัน
// =============================================
router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, email, full_name, phone, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

// =============================================
// PUT /api/auth/profile - แก้ไขโปรไฟล์
// =============================================
router.put('/profile', auth, async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    const userId = req.user.id;

    // Email is required — don't allow it to become NULL
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกอีเมล'
      });
    }

    // Check if email is already used by another user
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userId]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email นี้ถูกใช้แล้ว'
      });
    }

    await pool.query(
      'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
      [full_name || null, email, phone || null, userId]
    );

    // Return updated user
    const [users] = await pool.query(
      'SELECT id, username, email, full_name, phone, avatar_url FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'อัปเดตโปรไฟล์สำเร็จ',
      data: users[0]
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

// =============================================
// PUT /api/auth/change-password - เปลี่ยนรหัสผ่าน
// =============================================
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'
      });
    }

    // Get current user
    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ'
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

// ✅ FIX BUG-08: Generate unique card number with collision check
async function generateUniqueCardNumber(conn) {
  const MAX_RETRIES = 10;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(String(Math.floor(1000 + Math.random() * 9000)));
    }
    const cardNumber = segments.join(' ');

    // Check if this card number already exists
    const [existing] = await conn.query(
      'SELECT id FROM cards WHERE card_number = ?',
      [cardNumber]
    );
    if (existing.length === 0) {
      return cardNumber; // Unique!
    }
  }
  throw new Error('ไม่สามารถสร้างหมายเลขบัตรที่ไม่ซ้ำได้');
}

module.exports = router;
