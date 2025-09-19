const socket = io();
const sessionId = "test-session"; // beta: simple fixed room
const player = { name: "Player1" };

function showBanner(msg, type = "info") {
  const b = document.getElementById("banner");
  b.className = `banner ${type}`;
  b.textContent = msg;
}

function clearBanner() {
  const b = document.getElementById("banner");
  b.className = "hidden";
  b.textContent = "";
}

socket.on("connect", () => {
  socket.emit("joinSession", { sessionId, player });
});

socket.on("sessionState", (state) => {
  clearBanner();
  renderNode(state.node);
});

socket.on("newNode", ({ node }) => {
  clearBanner();
  renderNode(node);
});

socket.on("errorBanner", ({ message }) => showBanner(message, "error"));

function renderNode(node) {
  const div = document.getElementById("game");
  if (!node) {
    showBanner("No content to display.", "error");
    return;
  }
  const choices = (node.choices || []).map(c =>
    `<button class="choice" data-choice="${c.id}">${c.label}</button>`
  ).join("");

  div.innerHTML = `
    <div class="speaker">${node.speaker || "Narrator"}</div>
    <div class="text">${node.text || ""}</div>
    <div class="choices">${choices}</div>
    ${node.end ? `<div class="chapter-end">Chapter Complete • Next: ${node.nextChapter || "TBD"}</div>` : ""}
  `;

  div.querySelectorAll(".choice").forEach(btn => {
    btn.onclick = () => {
      const choiceId = btn.getAttribute("data-choice");
      socket.emit("makeChoice", { sessionId, choiceId });
    };
  });
}
