import adminModel from "../models/adminModel.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) =>{
    const {token} = req.headers;
    if(!token){
        return res.json({success: false, message:"Not Authorized Login Again"});
    }
    try {
        const token_decode = jwt.verify(token,process.env.JWT_SECRET);
        req.body.userId = token_decode.id;
        req.userId = token_decode.id;
        next();
    } catch (error) {
        console.error(error);
        res.json({success: false, message:"Error"});
    }

}
const deliveryAuth = (req, res, next) => {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("❌ Missing or Incorrect Token Format:", authHeader);
        return res.status(401).json({ success: false, message: "Access denied. Invalid token format." });
    }

    // ✅ Extract only the token part
    const token = authHeader.split(" ")[1];

    try {
        console.log("🔑 Verifying Token:", token);
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        console.log("✅ Token Verified Successfully:", verified);

        if (verified.role !== "delivery") {
            console.error("❌ Unauthorized Access Attempt:", verified.role);
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        req.deliveryPerson = verified;
        console.log("✅ Token Verified for Delivery Person:", verified);
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            console.warn("🔄 Token expired. Refresh required.");
            return res.status(401).json({ success: false, message: "Token expired. Please refresh." });
        }
        console.error("❌ Invalid Token:", error.message);
        return res.status(401).json({ success: false, message: "Invalid token" });
    }
};

const adminAuth = async (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ success: false, message: "Access denied" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const admin = await adminModel.findById(decoded.id);
        if (!admin) return res.status(403).json({ success: false, message: "Unauthorized" });

        req.admin = admin;
        next();
    } catch (error) {
        res.status(400).json({ success: false, message: "Invalid token" });
    }
};
export {authMiddleware, deliveryAuth,adminAuth};