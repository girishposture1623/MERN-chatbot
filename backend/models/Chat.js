import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    conversationId: {
       type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    reply: {
      type: String,
      required: true,
    },
  },
  { timeseries: true },
);

chatSchema.index({ conversationId: 1, createdAt: 1 });
const chatdata = mongoose.model("Chat", chatSchema);

export default chatdata;
