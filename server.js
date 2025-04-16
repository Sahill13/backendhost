import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import foodRouter from './routes/foodRoute.js';
import userRouter from './routes/userRoute.js';
import 'dotenv/config'
import cartRouter from './routes/cartRoute.js';
import orderRouter from './routes/orderRoute.js';
import deliveryRoutes from "./routes/deliveryRoutes.js";
import adminRoute from "./routes/adminRoute.js";



//app config
const app= express();
const port =process.env.port || 4000;
const allowedOrigins = ["http://localhost:5173","http://localhost:5174","http://localhost:4000","https://cravin-frontend.vercel.app", "https://fantastic-twilight-c86fc4.netlify.app", ];

// middleware
app.use(express.json())
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

//db connection
connectDB();

//api endpoints
app.use("/api/food",foodRouter)
app.use("/images",express.static('uploads'))
app.use("/api/user",userRouter)
app.use("/api/cart",cartRouter)
app.use("/api/order",orderRouter)
app.use("/api/delivery", deliveryRoutes);
app.use("/api/admin", adminRoute);


app.get("/",(req,res)=>{
    res.send("CravIn backend is live 🚀")
})

app.listen(port,()=>{
    console.log(`Server is running on http://localhost:${port}`)
})


