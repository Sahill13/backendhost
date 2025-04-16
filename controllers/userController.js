import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator"

const getSuperCoins = async (req, res) => {
    try {
        const userId = req.userId;  // ✅ Extracted from authMiddleware
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const user = await userModel.findById(userId).select("superCoins"); // ✅ Optimize query
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, superCoins: user.superCoins });
    } catch (error) {
        console.error("Error fetching SuperCoins:", error);
        res.status(500).json({ success: false, message: "Error fetching SuperCoins" });
    }
};

// ✅ Add SuperCoins when user places an order
const addSuperCoins = async (req, res) => {
    try {
        const userId = req.userId; // ✅ Extract from authMiddleware
        const { orderAmount } = req.body;

        if (!orderAmount || orderAmount < 0) {
            console.error("❌ Invalid orderAmount:", orderAmount);
            return res.status(400).json({ success: false, message: "Invalid order amount" });
        }


        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (typeof user.superCoins !== "number") {
            user.superCoins = 0;
        }

        const earnedCoins = Math.floor(orderAmount / 50); // 🔹 Earn 1 SuperCoin per ₹50 spent
        console.log(`🪙 Adding ${earnedCoins} SuperCoins for User ${userId}`);

        user.superCoins += earnedCoins;
        await user.save();

        res.json({ success: true, message: `${earnedCoins} SuperCoins added`, superCoins: user.superCoins });
    } catch (error) {
        console.error("Error adding SuperCoins:", error);
        res.status(500).json({ success: false, message: "Error adding SuperCoins" });
    }
};

// ✅ Redeem SuperCoins during checkout
const redeemSuperCoins = async (req, res) => {
    try {
        const userId = req.userId || req.body.userId; // ✅ Ensure userId is extracted

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const { redeemAmount } = req.body;
        if (!redeemAmount || redeemAmount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid SuperCoin amount" });
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (redeemAmount > user.superCoins) {
            return res.status(400).json({ success: false, message: "Not enough SuperCoins" });
        }

        user.superCoins -= redeemAmount;
        await user.save();

        console.log(`✅ SuperCoins Subtracted: ${redeemAmount} for User: ${userId}`);

        res.json({ success: true, message: `${redeemAmount} SuperCoins redeemed`, superCoins: user.superCoins });
    } catch (error) {
        console.error("❌ Error redeeming SuperCoins:", error);
        res.status(500).json({ success: false, message: "Error redeeming SuperCoins" });
    }
};


// login user
const loginUser= async (req, res) => {
    const {email,password} = req.body;
    try{
        const user = await userModel.findOne({email})

        if(!user){
            return res.json({success:false, message:"User not found"})
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.json({success:false,message:"Invalid password"})
        }

        const token = createToken(user._id);
        res.json({success:true, token,user: {
            _id: user._id, 
            name: user.name,
            email: user.email,
            cartData: user.cartData, 
            securityCode: user.securityCode,
            cartCafeteriaId: user.cartCafeteriaId,// ✅ Send cartCafeteriaId to frontend
            superCoins: user.superCoins,  // ✅ Send SuperCoin balance to frontend
        }});

 
    }catch(error){
        console.log(error)
        res.json({success:false, message:"Failed to login"})
    }

}

const createToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, { expiresIn: "7d" });
}

const generateSecurityCode = () => Math.floor(1000 + Math.random() * 9000).toString();

//register user
const registerUser = async (req, res) => {
    const { name, password, email } = req.body;
    try {
        const exists = await userModel.findOne({ email });
        if (exists) {
            return res.json({ success: false, message: "User already exists" });
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" });
        }

        if (password.length < 8) {
            return res.json({ success: false, message: "Password should be at least 8 characters long" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const securityCode = generateSecurityCode(); // Generate 4-digit security code

        const newUser = new userModel({
            name,
            email,
            password: hashedPassword,
            securityCode, // Save security code,
            cartCafeteriaId: null, // Initialize cartCafeteriaId as null
            superCoins: 0, // ✅ Initialize SuperCoins to 0
        });

        const user = await newUser.save();
        const token = createToken(user._id);
        
        res.json({ 
            success: true, 
            token, 
            user: { 
                _id: user._id,  // ✅ Fix: Include user ID in the response
                name: user.name, 
                email: user.email, 
                securityCode: user.securityCode ,
                cartCafeteriaId: user.cartCafeteriaId ,// ✅ Send cartCafeteriaId to frontend
                superCoins: user.superCoins, // ✅ Send SuperCoin balance
            } 
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Failed to register user" });
    }
};
export {loginUser, registerUser,getSuperCoins, addSuperCoins, redeemSuperCoins};