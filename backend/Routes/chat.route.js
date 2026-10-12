import express from "express";
import {
  conversationDelete,
  conversationGet,
  conversationGetById,
  conversationpatch,
  messagegetbyId,
  messagepost,
  messagepostId,
  postconcersation,
} from "../controllers/chat.controllers.js";

const chatbotRoute = express.Router();

chatbotRoute.get("/conversations", conversationGet);

chatbotRoute.post("/conversations", postconcersation);

chatbotRoute.get("/conversations/:id", conversationGetById);

chatbotRoute.patch("/conversations/:id", conversationpatch);

chatbotRoute.delete("/conversations/:id", conversationDelete);

chatbotRoute.post("/conversations/:id/messages", messagepost);

chatbotRoute.post("/conversations/:id/messages/stream", messagegetbyId);

chatbotRoute.post("/conversations/:id/messages/regenerate", messagepostId);

export default chatbotRoute;
