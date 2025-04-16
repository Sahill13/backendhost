import mongoose from 'mongoose';
const orderSchema = new mongoose.Schema({
    orderNumber: { type: Number, unique: true, sparse: true },
    userId:{type:String,required: true},
    items:{type:Array,required:true},
    amount:{type:Number,required:true},
    address:{type:Object,required:true},
    status:{type:String, default:'pending'},
    cafeteriaId: { type: String, required: true },  // ✅ Added cafeteriaId field
    date:{type:Date,default: Date.now},
    payment:{type:Boolean,default:false},
     sessionUrl: { type: String },
    deliveryPerson: { type: mongoose.Schema.Types.ObjectId, ref: "Delivery", default: null },
    redeemedSuperCoins: { type: Number, default: 0 },  // ✅ Added redeemedSuperCoins field

    // ✅ Razorpay Fields (ADD THESE)
    razorpay_order_id: { type: String, default: null },
    razorpay_payment_id: { type: String, default: null },
    razorpay_signature: { type: String, default: null },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },

    orderType: { type: String, enum: ['Delivery', 'Takeaway'], default: 'Delivery' },
    pickupTime: { type: Date }, // only relevant for takeaway
});
orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) { 
        const lastOrder = await mongoose.model('order').findOne({}, {}, { sort: { orderNumber: -1 } });
        this.orderNumber = lastOrder && lastOrder.orderNumber ? lastOrder.orderNumber + 1 : 1000; // Start from 1000
    }
    next();
});



const orderModel = mongoose.models.order || mongoose.model("order",orderSchema);

export default orderModel;