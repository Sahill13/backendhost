// controllers/adminController.js
import adminModel from "../models/adminModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Admin Login
 */
export const loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    console.log("🔍 Admin Login Attempt:", { email, password });

    try {
        if (!email || !password) {
            console.log("❌ Missing Email or Password");
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }
        
        const admin = await adminModel.findOne({ email: { $regex: new RegExp("^" + email + "$", "i") } });
        if (!admin) {
            console.log("❌ Admin Not Found");
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        console.log("🛠 Found Admin:", admin);

        const isMatch = await bcrypt.compare(password, admin.password);
        console.log("🔍 Password Match:", isMatch);

        if (!isMatch) {
            console.log("❌ Incorrect Password");
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        if (!admin.cafeteriaId || admin.cafeteriaId.trim() === "") {
            console.log("❌ No cafeteria assigned to this admin");
            return res.status(400).json({ success: false, message: "Admin is not assigned to a cafeteria" });
        }
          // ✅ Normalize cafeteriaId (convert to lowercase and remove spaces)
          let normalizedCafeteriaId  = admin.cafeteriaId.trim().toLowerCase().replace(/\s+/g, '-');
          console.log("✅ Normalized Cafeteria ID:", normalizedCafeteriaId);

        console.log("✅ Generating Token for Admin:", admin.email);
        const token = jwt.sign(
            { id: admin._id, role: "admin", cafeteriaId: normalizedCafeteriaId }, 
            JWT_SECRET, 
            { expiresIn: "1d" }
        );

        console.log("✅ Admin Login Successful. Token Generated:", token);
        res.json({ 
            success: true, 
            token, 
            cafeteriaId: normalizedCafeteriaId, // ✅ Ensure cafeteriaId is included in response
            message: "Admin login successful" 
        });

    } catch (error) {
        console.error("❌ Admin Login Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getCafeterias = async (req, res) => {
    try {
        // ✅ Return a static array instead of fetching from DB
        const cafeterias = [
            { _id: "mblock", name: "mblock" },
            { _id: "ubblock", name: "ubblock" }
        ];

        res.json(cafeterias);
    } catch (error) {
        console.error("❌ Error fetching cafeterias:", error);
        res.status(500).json({ message: "Failed to fetch cafeterias", data: [] });
    }
};
export const addAdmin = async (req, res) => {
    const { name, email, password, cafeteriaId } = req.body;

    try {
        if (!name || !email || !password || !cafeteriaId) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const existingAdmin = await adminModel.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: "Admin already exists" });
        }

        // ✅ Ensure password is hashed only once
        console.log("🔹 Checking if password is already hashed...");
        let hashedPassword = password;
        if (!password.startsWith("$2b$10$")) {  // ✅ Prevent double hashing
            console.log("🔹 Hashing Password...");
            hashedPassword = await bcrypt.hash(password, 10);
            console.log("✅ Hashed Password:", hashedPassword);
        }

        const newAdmin = new adminModel({ 
            name, 
            email, 
            password: hashedPassword, // ✅ Save hashed password
            cafeteriaId 
        });

        await newAdmin.save();
        console.log("✅ Admin added successfully:", newAdmin);

        res.json({ success: true, message: "Admin added successfully!" });

    } catch (error) {
        console.error("❌ Error adding admin:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
