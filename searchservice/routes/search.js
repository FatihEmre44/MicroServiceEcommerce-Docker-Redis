const express = require('express');
const router = express.Router();

const { searchProducts, getSuggestions, getProductById } = require('../controllers/searchController');

// Ürün arama (public - auth gerektirmez)
router.get('/', searchProducts);

// Autocomplete önerileri (public)
router.get('/suggestions', getSuggestions);

// Tek ürün detayı (public)
router.get('/product/:id', getProductById);

module.exports = router;
