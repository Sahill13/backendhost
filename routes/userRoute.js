import express from 'express';
import { loginUser , registerUser,getSuperCoins,addSuperCoins,redeemSuperCoins } from '../controllers/userController.js';
import {authMiddleware} from '../middleware/auth.js';

const userRouter = express.Router();

userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);

// ✅ New SuperCoin Routes
userRouter.get('/supercoins',authMiddleware, getSuperCoins);  // Fetch SuperCoins
userRouter.post('/addsupercoins',authMiddleware, addSuperCoins);  // Add SuperCoins
userRouter.post('/redeemsupercoins',authMiddleware, redeemSuperCoins);  // Redeem SuperCoins

export default userRouter;