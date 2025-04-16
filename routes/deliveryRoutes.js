import express from "express";
import { loginDeliveryPerson,assignDelivery, markDelivered,addDeliveryPerson,refreshDeliveryToken } from "../controllers/deliveryController.js";
import {deliveryAuth } from "../middleware/auth.js"; 
const router = express.Router();

router.post("/login", loginDeliveryPerson);
router.post("/add", addDeliveryPerson);
router.post("/assign",deliveryAuth, assignDelivery);
router.post("/deliver/:orderId",deliveryAuth, markDelivered);
router.post("/refresh-token", refreshDeliveryToken); // ✅ Add new endpoint

export default router;