const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const TOKEN = process.env.WA_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;

const sessions = {};

const questions = [
  {
    q: "What is the capital of Nigeria?",
    a: "B",
    options: [
      { id: "A", title: "A. Lagos" },
      { id: "B", title: "B. Abuja" },
      { id: "C", title: "C. Kano" },
      { id: "D", title: "D. Ibadan" }
    ]
  },
  {
    q: "What is Nigeria's currency?",
    a: "C",
    options: [
      { id: "A", title: "A. Cedi" },
      { id: "B", title: "B. Rand" },
      { id: "C", title: "C. Naira" },
      { id: "D", title: "D. Dollar" }
    ]
  },
  {
    q: "Benin City is the capital of which state?",
    a: "A",
    options: [
      { id: "A", title: "A. Edo" },
      { id: "B", title: "B. Delta" },
      { id: "C", title: "C. Ondo" },
      { id: "D", title: "D. Ekiti" }
    ]
  }
];

async function sendMessage(to, message) {
  await fetch(
    `https://graph.facebook.com/v26.0/${PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: message }
      })
    }
  );
}

async function sendMenu(to) {
  await sendMessage(
    to,
    "🇳🇬 MANIA 9JA PLAY 🎮\n\n" +
    "Welcome!\n\n" +
    "1. 9ja Quiz\n" +
    "2. Emoji Decoder\n\n" +
    "Reply 1 or 2 to play.\n" +
    "Type STOP to pause."
  );
}

async function sendQuestion(to) {
  const s = sessions[to];
  const question = questions[s.index];

  await sendMessage(
    to,
    `🇳🇬 9JA QUIZ\n\n${question.q}\n\n` +
    question.options.map(o => o.title).join("\n") +
    "\n\nReply A, B, C or D."
  );
}

async function handleMessage(to, text) {
  const input = text.trim().toLowerCase();

  if (input === "stop") {
    delete sessions[to];
    return sendMessage(to, "MANIA 9JA PLAY paused. Type START to play again.");
  }

  if (["start", "hello", "hi", "menu"].includes(input)) {
    delete sessions[to];
    return sendMenu(to);
  }

  if (input === "1" || input === "quiz") {
    sessions[to] = { index: 0, score: 0 };
    return sendQuestion(to);
  }

  if (input === "2" || input === "emoji") {
    return sendMessage(
      to,
      "😂 EMOJI DECODER\n\n🍚 + 🍅 + 🌶️\n\nWhat Nigerian food is this?\n\nType your answer."
    );
  }

  if (input.includes("jollof")) {
    return sendMessage(to, "✅ Correct! It's Jollof Rice!\n\nType MENU to play again.");
  }

  const s = sessions[to];

  if (!s) {
    return sendMessage(to, "Type START to open MANIA 9JA PLAY.");
  }

  const answer = input.toUpperCase();

  if (!["A", "B", "C", "D"].includes(answer)) {
    return sendMessage(to, "Please reply A, B, C or D.");
  }

  const question = questions[s.index];

  if (answer === question.a) {
    s.score++;
    await sendMessage(to, "✅ Correct!");
  } else {
    await sendMessage(to, `❌ Wrong! The answer was ${question.a}.`);
  }

  s.index++;

  if (s.index >= questions.length) {
    const score = s.score;
    delete sessions[to];

    return sendMessage(
      to,
      `🏁 Quiz complete!\n\nYour score: ${score}/${questions.length}\n\nType START to play again.`
    );
  }

  await sendQuestion(to);
}

app.get("/", (req, res) => {
  res.send("MANIA 9JA PLAY is running!");
});

app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }

  res.sendStatus(403);
});

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];

  if (!signature || !APP_SECRET) {
    return res.sendStatus(403);
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", APP_SECRET)
      .update(req.body)
      .digest("hex");

  if (signature !== expected) {
    return res.sendStatus(403);
  }

  const body = JSON.parse(req.body.toString());
  res.sendStatus(200);

  const messages =
    body.entry?.[0]?.changes?.[0]?.value?.messages || [];

  for (const message of messages) {
    if (message.type === "text") {
      await handleMessage(message.from, message.text.body);
    }
  }
});

app.listen(PORT, () => {
  console.log("MANIA 9JA PLAY started!");
});
