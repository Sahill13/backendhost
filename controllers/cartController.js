import userModel from '../models/userModel.js';

// 🚀 Add item to user's cart (with cafeteria restriction)
const addToCart = async (req, res) => {
    try {
        const { userId, itemId, cafeteriaId } = req.body;

        if (!cafeteriaId) {
            return res.status(400).json({ success: false, message: "❌ Cafeteria selection is required!" });
        }

        let userData = await userModel.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let cartData = userData.cartData || {};
        let existingCafeteria = userData.cartCafeteriaId || cafeteriaId; // ✅ Retrieve existing cafeteriaId

        // ✅ Restrict adding items from multiple cafeterias
        if (existingCafeteria && existingCafeteria !== cafeteriaId) {
            return res.status(400).json({ success: false, message: "❌ You can only order from one cafeteria at a time! Clear your cart first." });
        }

        // ✅ Set cafeteriaId when adding the first item
        if (!userData.cartCafeteriaId) {
            userData.cartCafeteriaId = cafeteriaId;
        }

        // ✅ Update cart data
        cartData[itemId] = (cartData[itemId] || 0) + 1;

        // ✅ Save changes
        await userModel.findByIdAndUpdate(userId, { cartData, cartCafeteriaId: userData.cartCafeteriaId }, { new: true });

        return res.json({ success: true, message: "✅ Item added to cart" });

    } catch (error) {
        console.error("❌ Error adding to cart:", error);
        return res.status(500).json({ success: false, message: "Failed to add item to cart" });
    }
};


// 🚀 Remove item from user's cart
const removeFromCart = async (req, res) => {
    try {
        const { userId, itemId } = req.body;

        let userData = await userModel.findById(userId);
        if (!userData) {
            return res.json({ success: false, message: "User not found" });
        }

        let cartData = userData.cartData || {};

        // ✅ Only decrement if item exists and count > 0
        if (cartData[itemId] && cartData[itemId] > 0) {
            cartData[itemId] -= 1;
            if (cartData[itemId] === 0) {
                delete cartData[itemId]; // Remove item if count is 0
            }
        }

        // ✅ Clear cafeteriaId if cart is empty
        const isCartEmpty = Object.keys(cartData).length === 0;
        if (isCartEmpty) {
            userData.cartCafeteriaId = null;
        }

        await userModel.findByIdAndUpdate(userId, { cartData, cartCafeteriaId: isCartEmpty ? null : userData.cartCafeteriaId });

        return res.json({ success: true, message: "✅ Item removed from cart" });

    } catch (error) {
        console.error("❌ Error removing from cart:", error);
        return res.json({ success: false, message: "Failed to remove item from cart" });
    }
};

// 🚀 Fetch user cart data
const getCart = async (req, res) => {
    try {
        const { userId } = req.body;

        let userData = await userModel.findById(userId);
        if (!userData) {
            return res.json({ success: false, message: "User not found" });
        }

        return res.json({
            success: true,
            cartData: userData.cartData || {},
            cartCafeteriaId: userData.cartCafeteriaId || null
        });

    } catch (error) {
        console.error("❌ Error fetching cart:", error);
        return res.json({ success: false, message: "Error fetching cart" });
    }
};

// 🚀 Clear user's cart
const clearCart = async (req, res) => {
    try {
        const { userId } = req.body;

        let userData = await userModel.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // ✅ Clear cartData and cartCafeteriaId
        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { cartData: {}, cartCafeteriaId: null },
            { new: true } // ✅ Ensures updated user data is returned
        );

        return res.json({ success: true, message: "✅ Cart successfully cleared", user: updatedUser });

    } catch (error) {
        console.error("❌ Error clearing cart:", error);
        return res.status(500).json({ success: false, message: "Error clearing cart" });
    }
};


export { addToCart, removeFromCart, getCart, clearCart };
