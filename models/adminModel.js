// models/adminModel.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    cafeteriaId: { type: String, required: true }, // ✅ Assign cafeteria
});

// ✅ Hash password before saving
adminSchema.pre('save', async function (next) {
    if (!this.isModified('password') || this.password.startsWith("$2b$")) {
        return next(); // ✅ Skip hashing if already hashed
    }
    
    console.log("🔹 Hashing Password Before Saving...");
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ✅ Compare passwords
adminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Admin", adminSchema);
