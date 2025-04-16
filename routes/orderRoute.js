import express from 'express';
import {authMiddleware} from "../middleware/auth.js";
import { placeOrder, userOrders, verifyOrder,listOrders,updateStatus,approveOrder,completeOrder,rejectOrder, getPendingOrders, getOrderById,getDeliveryOrders,verifySecurityCode,  } from '../controllers/orderController.js';
import orderModel from '../models/orderModel.js';


const orderRouter = express.Router();

orderRouter.post('/place', authMiddleware, placeOrder);
orderRouter.post('/verify', verifyOrder);
orderRouter.post('/userorders', authMiddleware, userOrders);
orderRouter.get('/list', listOrders);
orderRouter.post('/status', updateStatus);
orderRouter.patch('/:orderId/approve', approveOrder);  // Using PATCH for status update
orderRouter.patch('/:orderId/reject', rejectOrder);   // Using PATCH for status update
orderRouter.patch('/:orderId/complete', completeOrder);
orderRouter.get('/admin/pending', getPendingOrders);
orderRouter.get('/order/:orderId', getOrderById); 
// NEW endpoint for delivery orders
orderRouter.get('/delivery/orders', getDeliveryOrders);
orderRouter.post('/:orderId/verify-security-code', verifySecurityCode);

export default orderRouter;
