import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Razorpay from "razorpay";
import crypto from "crypto";

// Place order from the frontend
const placeOrder = async (req, res) => {
    try {
        const { userId, items, amount, address, cafeteriaId,redeemedSuperCoins,orderType } = req.body;
        console.log("📌 Received Order Data:", req.body);

        if (!userId || !items || !amount || !address || !cafeteriaId) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        if (!Array.isArray(items) || items.length === 0) {
            console.error("❌ Invalid items array:", items);
            return res.status(400).json({ success: false, message: "Invalid items list" });
        }

        if (amount <= 0 || isNaN(amount)) {
            console.error("❌ Invalid order amount:", amount);
            return res.status(400).json({ success: false, message: "Invalid order amount" });
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        
        let discountApplied = Math.min(redeemedSuperCoins, Math.floor(amount * 0.1)); // Max 10% discount
        if (discountApplied > user.superCoins) {
            discountApplied = user.superCoins; // Don't allow more than available balance
        }

         // ✅ Deduct SuperCoins from User's Balance
         await userModel.findByIdAndUpdate(userId, { $inc: { superCoins: -discountApplied } });

          // ✅ Update Final Order Amount
        const discountedAmount = amount - discountApplied;
        
        //takeaway orders
        let pickupTime = null;
        if (orderType === 'Takeaway') {
        const WAITING_MINUTES = 15;
        pickupTime = new Date(Date.now() + WAITING_MINUTES * 60000);
        }


        console.log("📌 Order Request Data:", req.body);  // ✅ Debug the request paylo
        const formattedCafeteriaId = cafeteriaId.trim().toLowerCase().replace(/\s+/g, '-'); // ✅ Normalize
        const newOrder = new orderModel({
            userId,
            items,
            amount:discountedAmount,
            address,
            cafeteriaId: formattedCafeteriaId,  // ✅ Store cafeteriaId in DB
            status: 'pending', // Set initial status as pending
            redeemedSuperCoins:  redeemedSuperCoins || 0,  // ✅ Ensure it is stored correctly, // ✅ Store the redeemed amount
            orderType: orderType || 'Delivery',
            pickupTime: pickupTime
        });
        await newOrder.save();
        console.log("🛒 Order Saved with SuperCoins Applied:", newOrder);

        res.json({ success: true, orderId: newOrder._id, orderNumber: newOrder.orderNumber,discountApplied,
            finalAmount: discountedAmount });

    } catch (error) {
        console.error("Error during order creation:", error);
        res.status(500).json({ success: false, message: "Order creation failed", error: error.message });
    }
};

// Get pending orders for admin
const getPendingOrders = async (req, res) => {
    let { cafeteriaId } = req.query;

    if (!cafeteriaId) {
        return res.status(400).json({ success: false, message: "Cafeteria ID is required" });
    }

    try {
        cafeteriaId = cafeteriaId.trim().toLowerCase().replace(/\s+/g, '-'); // ✅ Normalize
        console.log("🔍 Fetching pending orders for cafeteria:", cafeteriaId);

        // ✅ Debug: Print all cafeteriaId values in DB
        const allOrders = await orderModel.find({ status: "pending" });
        console.log("📌 Existing Cafeteria IDs in DB:", allOrders.map(o => o.cafeteriaId));

        const orders = await orderModel.find({
            cafeteriaId: cafeteriaId, // ✅ Use exact match for debugging
            status: "pending"
        });

        console.log("✅ Orders Retrieved from DB:", orders.length, "orders found");
        console.log("📌 Retrieved Orders:", orders); // ✅ Log exact matching orders

        res.json({ success: true, orders });
    } catch (error) {
        console.error("❌ Error fetching pending orders:", error);
        res.status(500).json({ success: false, message: "Error fetching pending orders" });
    }
};

const approveOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log(`🔄 Approving order with ID: ${orderId}`);

        // Fetch order from database
        const order = await orderModel.findById(orderId);
        if (!order) {
            console.log(`❌ Order not found: ${orderId}`);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        console.log(`📌 Order found:`, order);

        if (!order.amount) {
            console.log(`❌ Order amount missing: ${orderId}`);
            return res.status(400).json({ success: false, message: 'Order amount missing' });
        }

        order.status = 'approved';

        const totalAmount = order.amount;
        const superCoinDiscount = order.redeemedSuperCoins || 0;
        const finalAmount = Math.max(totalAmount - superCoinDiscount, 0);

        console.log(`💰 Total Order Amount: ${totalAmount}`);
        console.log(`🪙 SuperCoins Redeemed: ${superCoinDiscount}`);
        console.log(`🔍 Final Amount to Charge (after discount): ${finalAmount}`);

        if (finalAmount <= 0) {
            console.log(`❌ Invalid amount after discount: ${finalAmount}`);
            return res.status(400).json({ success: false, message: 'Invalid amount after discount' });
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error("❌ Razorpay credentials missing!");
            return res.status(500).json({ success: false, message: "Payment gateway credentials missing" });
        }

        console.log("⚡ Creating Razorpay order...");
        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const receiptId = `rec_${order.orderNumber}`;

        const razorpayOrder = await new Promise((resolve, reject) => {
             razorpayInstance.orders.create({
             amount: finalAmount * 100,
             currency: "INR",
                receipt: receiptId,
                 payment_capture: 1,
        }, (err, order) => {
        if (err) reject(err);
        else resolve(order);
        });
        });
        const sessionUrl = `/payment?order_id=${razorpayOrder.id}`; 

        // Store Razorpay Order ID in Database
        order.sessionUrl = sessionUrl;
        order.razorpay_order_id = razorpayOrder.id;
        await order.save();
        console.log(`✅ Razorpay Order Created: ${razorpayOrder.id}`);
        console.log(`🔗 Session URL: ${sessionUrl}`);

        // ✅ Send `razorpayKey` in response
        res.json({
            success: true,
            status: 'approved',
            razorpay_order_id: razorpayOrder.id,
            sessionUrl: sessionUrl,
            amount: finalAmount,
            currency: 'INR',
            razorpayKey: process.env.RAZORPAY_KEY_ID // ✅ FIXED
        });

    } catch (error) {
        console.error("❌ Error approving order:", error);
        res.status(500).json({ success: false, message: 'Error processing approval', error: error.message });
    }
};





// Get orders ready for delivery: paid orders with status "Out for Delivery"
const getDeliveryOrders = async (req, res) => {
    try {
        let { block } = req.query;  // ✅ Get block from frontend

        if (!block) {
            return res.status(400).json({ success: false, message: "Block is required" });
        }
        
        block = block.trim().toLowerCase();  // ✅ Normalize block name
        console.log("📌 Fetching delivery orders for block:", block);

      const orders = await orderModel.find({
        cafeteriaId: block,   // ✅ Filter by cafeteria ID
        payment: true,
        status: { $regex: /^out for delivery$/i }
      }).populate("deliveryPerson");

      console.log(`✅ Found ${orders.length} orders for block ${block}`);
      res.json({ success: true, orders });
      
    } catch (error) {
      console.error("Error fetching delivery orders:", error);
      res.status(500).json({ success: false, message: "Error fetching delivery orders" });
    }
  };
  


const getOrderById = async (req, res) => {
    const { orderId } = req.params;
    console.log("Fetching order with ID:", orderId);  // Debug log
    try {
        const order = await orderModel.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        res.json({
            success: true,
            status: order.status,
            sessionUrl: order.status === 'approved' ? order.sessionUrl : null,
            razorpay_order_id: order.razorpay_order_id || null, // ✅ Include Razorpay Order ID
            amount: order.amount || 0,
            currency: "INR",
            razorpayKey: process.env.RAZORPAY_KEY_ID // ✅ Send Public Key
        });
    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({ success: false, message: "Error fetching order" });
    }
};

// Reject an order
const rejectOrder = async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await orderModel.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        order.status = 'rejected';
        await order.save();
        res.json({ success: true, message: 'Order rejected' });
    } catch (error) {
        console.error("Error rejecting order:", error);
        res.status(500).json({ success: false, message: 'Error rejecting order' });
    }
};

// Mark order as completed
const completeOrder = async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await orderModel.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        order.status = 'Food Processing';
        await order.save();

        res.json({ success: true, message: 'Order marked as completed' });
    } catch (error) {
        console.error("Error completing order:", error);
        res.status(500).json({ success: false, message: 'Error marking order as completed' });
    }
};

// Verify payment and update order status
const verifyOrder = async (req, res) => {
    console.log("========== 🔍 START BACKEND VERIFICATION ==========");

    try {
        console.log("📥 STEP 1: Full req.body received:");
        console.log(JSON.stringify(req.body, null, 2));

        const { paymentResponse, orderId } = req.body;

        if (!paymentResponse) {
            console.log("❌ ERROR: Missing 'paymentResponse' in req.body!");
            console.log("========== ❌ VERIFICATION FAILED (Missing Payment Data) ==========");
            return res.status(400).json({ success: false, message: "Missing payment details" });
        }

        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentResponse;

        console.log("📦 STEP 2: Extracted payment fields:");
        console.log("👉 razorpay_order_id:", razorpay_order_id);
        console.log("👉 razorpay_payment_id:", razorpay_payment_id);
        console.log("👉 razorpay_signature:", razorpay_signature);

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            console.log("❌ ERROR: One or more extracted payment fields are missing!");
            console.log("========== ❌ VERIFICATION FAILED (Invalid Payment Fields) ==========");
            return res.status(400).json({ success: false, message: "Invalid payment details" });
        }

        // STEP 3: Generate Signature
        const generated_signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        console.log("🧮 STEP 3: Generated signature for validation:");
        console.log("🔐 generated_signature:", generated_signature);
        console.log("🔐 received_signature :", razorpay_signature);

        // STEP 4: Validate Signature
        if (generated_signature !== razorpay_signature) {
            console.log("❌ ERROR: Signature mismatch! Potential tampering.");
            console.log("========== ❌ VERIFICATION FAILED (Signature Mismatch) ==========");
            return res.status(400).json({ success: false, message: "Invalid Payment Signature" });
        }

        // STEP 5: Update order status in database
        const updatedOrder = await orderModel.findOneAndUpdate(
            { _id: orderId },
            {
                status: "completed",
                payment: true,
                paymentStatus: "paid",
                razorpay_payment_id,
                razorpay_signature
            },
            { new: true }
        );
        // STEP 6: Add SuperCoins after successful payment
        const earnedCoins = Math.floor(updatedOrder.amount / 50);
        console.log(`🪙 Attempting to add ${earnedCoins} SuperCoins to User: ${updatedOrder.userId}`);
        
        try {
            const updatedUser = await userModel.findByIdAndUpdate(
                updatedOrder.userId,
                { $inc: { superCoins: earnedCoins } },
                { new: true }
            );
        
            if (updatedUser) {
                console.log(`✅ SuperCoins added! New total: ${updatedUser.superCoins}`);
            } else {
                console.error("❌ User not found while adding SuperCoins.");
                return res.status(500).json({ success: false, message: "Failed to add SuperCoins" });
            }
        } catch (err) {
            console.error("❌ Error adding SuperCoins:", err);
            return res.status(500).json({ success: false, message: "Failed to add SuperCoins" });
        }


        console.log("✅ STEP 5: Payment verified and order updated successfully in DB:");
        console.log(JSON.stringify(updatedOrder, null, 2));
        console.log("========== ✅ PAYMENT VERIFIED SUCCESSFULLY ==========");

        return res.json({ success: true, message: "Payment verified successfully" });

    } catch (error) {
        console.log("🚨 ERROR: Exception occurred during verification:");
        console.error(error);
        console.log("========== ❌ VERIFICATION FAILED (Server Error) ==========");
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// Retrieve user's paid orders
const userOrders = async (req, res) => {
    try {
        const orders = await orderModel.find({ userId: req.body.userId,  payment: true });
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).json({ success: false, message: "Error fetching user orders" });
    }
};

// List all paid orders for admin
const listOrders = async (req, res) => {
    try {
        let { cafeteriaId } = req.query;
        if (!cafeteriaId) {
            return res.status(400).json({ success: false, message: "Cafeteria ID is required" });
        }

        cafeteriaId = cafeteriaId.trim().toLowerCase();  // ✅ Normalize

        console.log("📌 Fetching Paid Orders for Cafeteria:", cafeteriaId);

        const orders = await orderModel.find(
            { cafeteriaId: cafeteriaId, payment: true }, // ✅ Ensure exact match
            { orderNumber: 1, items: 1, amount: 1, address: 1, status: 1, date: 1, payment: 1,orderType: 1, pickupTime: 1 }
        ).sort({ date: -1 });

        console.log("✅ Paid Orders Retrieved:", orders.length);
        res.json({ success: true, data: orders });

    } catch (error) {
        console.error("❌ Error listing orders:", error);
        res.status(500).json({ success: false, message: "Error listing orders" });
    }
};

// Update order status
const updateStatus = async (req, res) => {
    try {
        await orderModel.findByIdAndUpdate(req.body.orderId, { status: req.body.status });
        res.json({ success: true, message: "Status updated" });
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ success: false, message: "Error updating status" });
    }
};

const verifySecurityCode = async (req, res) => {
    const { orderId } = req.params;
    const { securityCode, userId, deliveryPersonId } = req.body;

    try {
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (user.securityCode !== securityCode) {
            return res.status(400).json({ success: false, message: "Incorrect security code" });
        }

        const order = await orderModel.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        order.status = "Delivered";
        order.deliveredAt = new Date();
        order.deliveryPerson = deliveryPersonId; // Save delivery person ID
        await order.save();

        console.log(`✅ Order ${orderId} delivered by Delivery Person ${deliveryPersonId}`);

        res.json({ success: true, message: "Order successfully delivered!" });
    } catch (error) {
        console.error("Error verifying security code:", error);
        res.status(500).json({ success: false, message: "Error verifying security code" });
    }
};


export {
    placeOrder,
    verifyOrder,
    userOrders,
    listOrders,
    updateStatus,
    getPendingOrders,
    approveOrder,
    rejectOrder,
    completeOrder,
    getOrderById,
    getDeliveryOrders,
    verifySecurityCode ,//// NEW endpoint for the delivery panel
    
};
