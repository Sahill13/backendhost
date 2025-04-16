import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true,unique: true},
    password: {type: String, required: true},
    securityCode: { type: String, required: true }, // Store the 4-digit security code
    cartData: {type: Object, default:{}},
    cartCafeteriaId: { type: String, default: null }, // ✅ Added to enforce cafeteria restriction
    superCoins: { type: Number, default: 0 } // ✅ Store SuperCoins
},{minimize:false})

const userModel = mongoose.models.user || mongoose.model("user",userSchema);

export default userModel;