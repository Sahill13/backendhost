import foodModel from "../models/foodModel.js";
import fs from 'fs'


//add food item

const addFood = async (req,res)=>{
    
    let image_filename =`${req.file.filename}`;

    const food = new foodModel({
        name:req.body.name,
        description:req.body.description,
        price:req.body.price,
        category:req.body.category,
        image:image_filename,
        cafeteriaId: req.body.cafeteriaId 
    })
    try {
        await food.save();
        res.json({success:true,message:"Food added successfully"})
    }catch(error){
        console.log(error)
        res.json({success:false,message:"Error"})
    }
}

//all food list
const listFood = async (req, res) => {
    try {
        const { cafeteriaId } = req.query;
        const query = cafeteriaId ? { cafeteriaId } : {};
        const foods = await foodModel.find(query);

        // ✅ Ensure response always contains "data"
        res.json({ success: true, data: foods || [] });

    } catch (error) {
        console.error("❌ Error fetching food:", error);
        res.status(500).json({ success: false, message: "Error fetching food", data: [] });
    }
};


// remove food item
const removeFood = async (req,res)=>{
    try{
        const food = await foodModel.findById(req.body.id);
        fs.unlink(`uploads/${food.image}`,()=>{})

        await foodModel.findByIdAndDelete(req.body.id);
        res.json({success:true,message:"food removed"})

        }catch(error){
            console.log(error);
            res.json({success:false,message:"Error"})

    }

}


export {addFood,listFood,removeFood}