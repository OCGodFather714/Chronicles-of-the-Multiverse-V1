// server.js — solid, crash-safe MVP (Chapter 1 only, party mode)
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
const PORT = process.env.PORT || 3000;
const MODE_DEFAULT = process.env.MODE_DEFAULT || "party"; // party only for beta

// ---- load story (chapter 1) ----
function loadChapter1() {
  const p = path.join(process.cwd(), "story", "chapter1.json");
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw);
  if (!data.startNode || !data.nodes) throw new Error("Invalid chapter1.json");
  return data;
}
const story = loadChapter1();

// ---- app + server + socket.io ----
const app = express();
app.use(express.static("web"));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// ---- in-memory sessions (MVP) ----
/*
  sessions = {
    [sessionId]: {
      mode: "party",
      node: "nodeId",
      players: { [socketId]: { id, name } }
    }
  }
*/
const sessions = Object.create(null);

function safeNode(nodeId) {
  const n = story.nodes[nodeId];
  if (!n) return { type: "narration", speaker: "System", text: "Missing node.", choices: [] };
  // normalize choices to empty array when missing
  return { ...n, choices: Array.isArray(n.choices) ? n.choices : [] };
}

io.on("connection", (socket) => {
  socket.on("joinSession", ({ sessionId = "test-session", player = { name: "Player" } } = {}) => {
    if (!sessions[sessionId]) {
      sessions[sessionId] = { mode: MODE_DEFAULT, node: story.startNode, players: {} };
    }
    sessions[sessionId].players[socket.id] = { id: socket.id, name: player.name || "Player" };
    socket.join(sessionId);

    const nodeId = sessions[sessionId].node;
    io.to(sessionId).emit("sessionState", {
      sessionId,
      mode: sessions[sessionId].mode,
      players: Object.values(sessions[sessionId].players),
      nodeId,
      node: safeNode(nodeId)
    });
  });

  socket.on("makeChoice", ({ sessionId, choiceId }) => {
    const s = sessions[sessionId];
    if (!s) return;

    const current = safeNode(s.node);
    const choice = current.choices.find(c => c.id === choiceId);
    if (!choice) {
      socket.emit("errorBanner", { message: "Invalid choice." });
      return;
    }

    const nextId = choice.leadsTo;
    s.node = nextId;
    io.to(sessionId).emit("newNode", { nodeId: nextId, node: safeNode(nextId) });
  });

  socket.on("disconnect", () => {
    for (const sid of Object.keys(sessions)) {
      delete sessions[sid].players[socket.id];
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`COTM server running on ${PORT}`);
});
