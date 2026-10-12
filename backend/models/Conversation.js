
import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
  { timestamps: true }
);



const Conversation = mongoose.model("Conversation", conversationSchema)

export default Conversation
 