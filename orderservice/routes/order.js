const express = require('express');
const router = express.Router();

const { createOrder, getMyOrders, getOrderById, cancelOrder } = require('../controllers/ordercontroller');
const { verifyTokenRemote } = require('../middleware/auth');

// Tüm sipariş işlemleri auth gerektirir
router.post('/', verifyTokenRemote, createOrder);
router.get('/', verifyTokenRemote, getMyOrders);
router.get('/:id', verifyTokenRemote, getOrderById);
router.put('/:id/cancel', verifyTokenRemote, cancelOrder);

module.exports = router;
