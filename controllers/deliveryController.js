import orderModel from "../models/orderModel.js";
import deliveryModel from "../models/deliveryModel.js";
import userModel from "../models/userModel.js";  
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Add a new delivery person
 */
const addDeliveryPerson = async (req, res) => {
    const { name, phone, username, password,block } = req.body;

    if (!block || !["mblock", "ubblock"].includes(block)) {
        return res.status(400).json({ success: false, message: "Invalid block assigned" });
    }

    try {
        // Check if username or phone already exists
        const existingPerson = await deliveryModel.findOne({ $or: [{ phone }, { username }] });
        if (existingPerson) {
            return res.status(400).json({ success: false, message: "Username or phone already exists" });
        }

        // Hash the password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new delivery person
        const newDeliveryPerson = new deliveryModel({
            name,
            phone,
            username:username.toLowerCase(),
            password: hashedPassword, // Store the hashed password
            status: "Available",
            assignedOrders: [],
            block,
        });

        await newDeliveryPerson.save();
        res.json({ success: true, message: "Delivery person added successfully", deliveryPerson: newDeliveryPerson });
    } catch (error) {
        console.error("Error adding delivery person:", error);
        res.status(500).json({ success: false, message: "Error adding delivery person", error: error.message });
    }
};

/**
 * Login a delivery person and generate JWT token
 */
const loginDeliveryPerson = async (req, res) => {
    const { username, password } = req.body;
    console.log("🔍 Login Attempt:", { username, password });

    try {
        const deliveryPerson = await deliveryModel.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } });

        if (!deliveryPerson) {
            console.log("❌ User not found");
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        console.log("🛠 Found User:", deliveryPerson);

        const isMatch = await bcrypt.compare(password, deliveryPerson.password);
        console.log("🔐 Entered Password:", password);
        console.log("🔐 Stored Hashed Password:", deliveryPerson.password);
        console.log("🔍 Password Match:", isMatch);

        if (!isMatch) {
            console.log("❌ Incorrect password");
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        // 🔍 Log before creating the token
        console.log("✅ Generating Token for User:", deliveryPerson.username);

        const token = jwt.sign(
            { id: deliveryPerson._id, role: "delivery", block: deliveryPerson.block  },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const refreshToken = jwt.sign(
            { id: deliveryPerson._id, role: "delivery",block: deliveryPerson.block },
            process.env.JWT_SECRET,
            { expiresIn: "7d" } // ✅ Long-lived refresh token (7 days)
        );

        res.json({ success: true, token, refreshToken,block: deliveryPerson.block,  message: `Login successful! Assigned to ${deliveryPerson.block}` });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Assign a delivery person to an order and mark it as "Out for Delivery"
 */
const assignDelivery = async (req, res) => {
    const { orderId } = req.body;

    try {
      
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        const cafeteriaBlock = order.cafeteriaId.toLowerCase(); // ✅ Determine block

        console.log("📌 Assigning delivery for:", cafeteriaBlock);

        const availableDeliveryPerson = await deliveryModel.findOne({ status: "Available",block: cafeteriaBlock });
        if (!availableDeliveryPerson) {
            return res.status(400).json({ success: false, message: "No delivery person available" });
        }


        if (order.status === "Out for Delivery" || order.status === "Delivered") {
            return res.status(400).json({ success: false, message: "Order is already assigned or delivered" });
        }

        order.status = "Out for Delivery";
        order.deliveryPerson = availableDeliveryPerson._id;
        await order.save();

        availableDeliveryPerson.status = "Busy";
        availableDeliveryPerson.assignedOrders.push(orderId);
        await availableDeliveryPerson.save();

        res.json({ success: true, message: `Order assigned to delivery person(${cafeteriaBlock}))`, order });
    } catch (error) {
        console.error("Error assigning delivery:", error);
        res.status(500).json({ success: false, message: "Error assigning delivery", error: error.message });
    }
};

/**
 * Mark an order as delivered
 */
const markDelivered = async (req, res) => {
    const { orderId } = req.params;
    const { securityCode, userId } = req.body;

    console.log("🔍 Received Data:", { orderId, securityCode, userId });

    try {
        if (!securityCode || !userId) {
            console.error("❌ Missing securityCode or userId");
            return res.status(400).json({ success: false, message: "Security code and user ID are required" });
        }

        const order = await orderModel.findById(orderId);
        console.log("📝 Fetched Order:", order);

        if (!order) {
            console.error("❌ Order Not Found");
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log("🚚 Order Status:", order.status);
        if (order.status.toLowerCase() !== "out for delivery") {
            console.error("❌ Order is not out for delivery");
            return res.status(400).json({ success: false, message: "Order is not out for delivery" });
        }

        const user = await userModel.findById(userId);
        console.log("📝 Fetched User:", user);

        if (!user) {
            console.error("❌ User Not Found");
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log("🔐 Stored Security Code:", user.securityCode, "🔑 Entered Code:", securityCode);
        if (user.securityCode !== securityCode) {
            console.error("❌ Incorrect Security Code");
            return res.status(400).json({ success: false, message: "Incorrect security code" });
        }

        // ✅ Update order as delivered
        order.status = "Delivered";
        await order.save();

        console.log("✅ Order marked as delivered:", orderId);

        // ✅ Update delivery person's status
        if (order.deliveryPerson) {
            const deliveryPerson = await deliveryModel.findById(order.deliveryPerson);
            if (deliveryPerson) {
                deliveryPerson.status = "Available";
                deliveryPerson.assignedOrders = deliveryPerson.assignedOrders.filter(id => id.toString() !== orderId);
                await deliveryPerson.save();
            }
        }

        res.json({ success: true, message: "Order marked as delivered" });

    } catch (error) {
        console.error("❌ Error marking order as delivered:", error);
        res.status(500).json({ success: false, message: "Error updating order status", error: error.message });
    }
};
const refreshDeliveryToken = async (req, res) => {
    const { refreshToken } = req.body; // ✅ Use refresh token

    if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token required" });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        // ✅ Generate a new short-lived access token
        const newToken = jwt.sign(
            { id: decoded.id, role: "delivery" },
            process.env.JWT_SECRET,
            { expiresIn: "15m" } // ✅ New access token valid for 15 minutes
        );

        res.json({ success: true, token: newToken });
    } catch (error) {
        console.error("❌ Refresh Token Error:", error.message);
        res.status(401).json({ success: false, message: "Invalid refresh token" });
    }
};


export { loginDeliveryPerson, assignDelivery, markDelivered,addDeliveryPerson,refreshDeliveryToken };
