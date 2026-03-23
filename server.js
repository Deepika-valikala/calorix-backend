require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");

const rateLimit = require("express-rate-limit");

const jwt = require("jsonwebtoken");


const SECRET_KEY = process.env.SECRET_KEY;
const app = express();
app.use(express.json());
app.use(cors());
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => {
    console.error("MongoDB Error ❌", err);
    process.exit(1); // stop app if DB fails
});

// Review schema
const Review = mongoose.model("Review",{
name:String,
orderCode:String,
title:String,
comment:String,
rating:Number,
media:String,
verified:Boolean,
approved:{
type:Boolean,
default:false
},
createdAt:{
type:Date,
default:Date.now
}
});
const Order = mongoose.model("Order",{
orderCode:String,
name:String,
phone:String,
address:String,
quantity:Number,
paymentMethod:String,
totalAmount:Number,
createdAt:{
type:Date,
default:Date.now
}
});

app.post("/create-order", async (req,res)=>{

const order = new Order(req.body);
await order.save();

res.json({message:"Order saved"});

});
// multer setup
const storage = multer.diskStorage({
destination:"uploads/",
filename:(req,file,cb)=>{
cb(null,Date.now()+"-"+file.originalname);
}
});

const upload = multer({
storage:storage,
limits:{fileSize:5*1024*1024},
fileFilter:(req,file,cb)=>{

const allowed = ["image/jpeg","image/png","image/webp","video/mp4"];

if(allowed.includes(file.mimetype)){
cb(null,true);
}else{
cb(new Error("Invalid file type"));
}

}
});
const loginLimiter = rateLimit({
windowMs: 15 * 60 * 1000, // 15 minutes
max: 5, // only 5 login attempts
message: "Too many login attempts. Try again later."
});

// POST review
app.post("/review",upload.single("media"),async(req,res)=>{

let verified = false;

const order = await Order.findOne({orderCode:req.body.orderCode});

if(order){
verified = true;
}

const review = new Review({
name:req.body.name,
orderCode:req.body.orderCode,
title:req.body.title,
comment:req.body.comment,
rating:req.body.rating,
media:req.file ? req.file.filename : null,
verified: verified
});

await review.save();

res.send("Review saved");

});

function verifyAdmin(req,res,next){

const authHeader = req.headers.authorization;

if(!authHeader){
return res.status(403).send("No token provided");
}

const token = authHeader.split(" ")[1];


try{

jwt.verify(token,SECRET_KEY);

next();

}catch(err){

res.status(401).send("Invalid token");

}

}
// test route
app.get("/", (req,res)=>{
    res.send("Backend is LIVE 🚀");
});
// Admin login
app.post("/admin/login", loginLimiter, async (req,res)=>{

const {username,password} = req.body;

console.log("Username:", username);

if(username !== process.env.ADMIN_USER){
    return res.status(401).json({message:"Invalid credentials"});
}

if(password !== process.env.ADMIN_PASS){
    return res.status(401).json({message:"Invalid credentials"});
}

const token = jwt.sign({role:"admin"}, process.env.SECRET_KEY,{expiresIn:"1h"});

res.json({token});

});

// Get all reviews (admin)
app.get("/admin/reviews",verifyAdmin,async(req,res)=>{

const reviews = await Review.find().sort({_id:-1});

res.json(reviews);

});


// Delete review
app.delete("/admin/review/:id",verifyAdmin, async (req,res)=>{

await Review.findByIdAndDelete(req.params.id);

res.json({message:"Review deleted"});

});


// Verify review
app.put("/admin/review/:id/verify",verifyAdmin, async (req,res)=>{

await Review.findByIdAndUpdate(req.params.id,{
verified:true
});

res.json({message:"Review verified"});

});
app.put("/admin/review/:id/approve", verifyAdmin, async (req,res)=>{

await Review.findByIdAndUpdate(req.params.id,{
approved:true
});

res.json({message:"Review approved"});

});
// get reviews
app.get("/reviews", async (req,res)=>{

const page = parseInt(req.query.page) || 1;
const limit = 5;

const reviews = await Review.find({approved:true})
.sort({_id:-1})
.skip((page-1)*limit)
.limit(limit);

const allReviews = await Review.find({approved:true});

res.json({
reviews: reviews,
total: allReviews.length,
all: allReviews
});

});



app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
console.log(`Server running on port ${PORT}`);

});