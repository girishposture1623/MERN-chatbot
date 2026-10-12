
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Chat from "../models/Chat.js";
import { generateReply, generateReplyStream } from "../services/chat.service.js";
import {
  escapeRegex,
  getHistoryMessages,
  saveConversationReply,
} from "../services/conversation.service.js";

// This controller runs in its own module scope; helpers declared in server.js
// are not visible here.
const validId = (id) => mongoose.isValidObjectId(id);


const conversationGet = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    let conversations = await Conversation.find()
      .sort({ updatedAt: -1 })
      .lean();

    if (q) {
      const matchingIds = await Chat.distinct("conversationId", {
        $or: [
          { message: { $regex: escapeRegex(q), $options: "i" } },
          { reply: { $regex: escapeRegex(q), $options: "i" } },
        ],
      });

      const ids = new Set(matchingIds.map(String));

      conversations = conversations.filter(
        (item) =>
          String(item.title || "")
            .toLowerCase()
            .includes(q.toLowerCase()) || ids.has(String(item._id))
      );
    }

    res.json(conversations);
  } catch (error) {
    console.error("List conversations:", error.message);
    res.status(500).json({ error: "Could not load conversations" });
  }
}

const postconcersation =  async (req, res) => {
  try {
    const conversation = await Conversation.create({
      title: "New chat",
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error("Create conversation:", error.message);
    res.status(500).json({ error: "Could not create conversation" });
  }
}

const conversationGetById = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const chats = await Chat.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });

    res.json({ conversation, chats });
  } catch (error) {
    console.error("Get conversation:", error.message);
    res.status(500).json({ error: "Could not load conversation" });
  }
}

const conversationpatch =async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const title = String(req.body.title || "").trim();

    if (!title || title.length > 100) {
      return res.status(400).json({
        error: "Title must contain 1 to 100 characters",
      });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { title },
      { returnDocument: "after", runValidators: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(conversation);
  } catch (error) {
    console.error("Rename conversation:", error.message);
    res.status(500).json({ error: "Could not rename conversation" });
  }
}

const conversationDelete =async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const id = new mongoose.Types.ObjectId(req.params.id);
    const conversation = await Conversation.findByIdAndDelete(id);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await Chat.deleteMany({ conversationId: id });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete conversation:", error.message);
    res.status(500).json({ error: "Could not delete conversation" });
  }
}

const messagepost =  async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const message = req.body.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (message.length > 10000) {
      return res.status(400).json({ error: "Message is too long" });
    }

    const id = new mongoose.Types.ObjectId(req.params.id);
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const { previous, messages } = await getHistoryMessages(id);

    messages.push({
      role: "user",
      content: message.trim(),
    });

    const reply = await generateReply(messages);

    const chat = await saveConversationReply({
      conversation,
      conversationId: id,
      message: message.trim(),
      reply,
      previous,
    });

    res.status(201).json({ chat, conversation });
  } catch (error) {
    console.error("Message error:", error.message);
    res.status(502).json({
      error: "All AI providers failed. Check API keys, models and quotas.",
    });
  }
}

const messagegetbyId =  async (req, res) => {
    let headersSent = false;
    let reply = "";
    let selectedProvider = null;

    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }

      const message = req.body.message;

      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      if (message.length > 10000) {
        return res.status(400).json({ error: "Message is too long" });
      }

      const id = new mongoose.Types.ObjectId(req.params.id);
      const conversation = await Conversation.findById(id);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const { previous, messages } = await getHistoryMessages(id);

      messages.push({
        role: "user",
        content: message.trim(),
      });

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      headersSent = true;

      for await (const part of generateReplyStream(messages)) {
        if (res.destroyed || res.writableEnded) return;

        selectedProvider = part.provider;
        reply += part.text;
        res.write(part.text);
      }

      if (!reply.trim()) {
        throw new Error("All providers returned an empty response");
      }

      await saveConversationReply({
        conversation,
        conversationId: id,
        message: message.trim(),
        reply,
        previous,
      });

      console.log(`Reply completed using ${selectedProvider}`);
      res.end();
    } catch (error) {
      console.error("Streaming error:", error.message);

      if (!headersSent) {
        return res.status(502).json({
          error: "All AI providers failed. Check API keys, models and quotas.",
        });
      }
    
      if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    }
  }

  const messagepostId =  async (req, res) => {
      try {
        const { id } = req.params;
        const { chatId } = req.body;
  
        if (!mongoose.isValidObjectId(id) ||
            !mongoose.isValidObjectId(chatId)) {
          return res.status(400).json({ error: "Invalid ID" });
        }
  
        const conversation = await Conversation.findById(id);
  
        if (!conversation) {
          return res.status(404).json({
            error: "Conversation not found",
          });
        }
  
        const chat = await Chat.findOne({
          _id: chatId,
          conversationId: id,
        });
  
        if (!chat) {
          return res.status(404).json({
            error: "Chat message not found",
          });
        }
  
        const previous = await Chat.find({
          conversationId: id,
          createdAt: { $lt: chat.createdAt },
        })
          .sort({ createdAt: 1 })
          .limit(30)
          .lean();
  
        const messages = [];
  
        for (const item of previous) {
          if (item.message) {
            messages.push({
              role: "user",
              content: item.message,
            });
          }
  
          if (item.reply) {
            messages.push({
              role: "assistant",
              content: item.reply,
            });
          }
        }
  
        messages.push({
          role: "user",
          content: chat.message,
        });
  
        res.status(200);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();
  
        let reply = "";
  
        for await (const part of generateReplyStream(messages)) {
          if (res.destroyed || res.writableEnded) return;
  
          reply += part.text;
          res.write(part.text);
        }
  
        if (!reply.trim()) {
          throw new Error("All providers returned an empty response");
        }
  
    
        await Chat.findByIdAndUpdate(chat._id, { reply });
  
        conversation.updatedAt = new Date();
        await conversation.save();
  
        res.end();
      } catch (error) {
        console.error("Regenerate error:", error.message);
  
        if (!res.headersSent) {
          return res.status(502).json({
            error: "Could not regenerate reply",
          });
        }
  
        if (!res.destroyed && !res.writableEnded) {
          res.end();
        }
      }
    }
  


export {
    conversationGet,
    postconcersation,
    conversationGetById,
    conversationpatch,
    conversationDelete,
    messagepost,
    messagegetbyId,
    messagepostId,
}; 
