const express = require('express');
const router = express.Router();


const { createProduct, updateProduct, deleteProduct } = require('../controllers/productcontroller');
const { checkOwnerOrAdmin, verifyTokenRemote } = require('../middleware/product');



// Ürün oluşturma (sadece seller veya admin)
router.post('/', verifyTokenRemote, createProduct);

// Ürün güncelleme (sadece sahibi veya admin)
router.put('/:id', verifyTokenRemote, checkOwnerOrAdmin, updateProduct);

// Ürün silme (sadece sahibi veya admin)
router.delete('/:id', verifyTokenRemote, checkOwnerOrAdmin, deleteProduct);

module.exports = router;
