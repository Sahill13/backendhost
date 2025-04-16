// routes/adminRoutes.js
import express from "express";
import { loginAdmin, addAdmin, getCafeterias } from "../controllers/adminController.js";

const router = express.Router();

router.post("/login", loginAdmin);
router.post("/add", addAdmin); // ✅ Add route for creating an admin
router.get("/cafeterias", getCafeterias); // ✅ Ensure cafeteria list is available

export default router;
