const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontrolle');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Kayıt ol
router.post('/register', authController.register);

// Giriş yap
router.post('/login', authController.login);

// Admin oluştur (sadece adminler)
router.post('/create-admin', verifyToken, isAdmin, authController.createAdmin);

// Kullanıcı güncelle (token gerekli)
router.put('/:id', verifyToken, authController.updateUser);

// Kullanıcı sil (token gerekli)
router.delete('/:id', verifyToken, authController.deleteUser);

module.exports = router;
