import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const deliverySchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    status: { type: String, default: "Available" }, // Available | Busy | Offline
    assignedOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    block: { type: String, required: true, enum: ["mblock", "ubblock"] } // ✅ New field
});

// ✅ Hash password before saving
deliverySchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ✅ Add method to compare passwords
deliverySchema.methods.matchPassword = async function (enteredPassword) {
    console.log("Entered:", enteredPassword);
    console.log("Stored Hash:", this.password);
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Delivery", deliverySchema);
