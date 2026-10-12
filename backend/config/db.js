import mongoose from "mongoose";

const connectDB = async()=>{
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/chatbot")
        console.log("Mongodb connected")
    } catch (error) {
        console.log("Database connection faild",error.message)
    }
}

export default connectDB