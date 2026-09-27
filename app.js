/**
 * Minimal live voting app - single file (except the admin view, which lives in views/admin.ejs).
 *
 * TO ADD A NEW QUESTION: just add an object to QUESTIONS below.
 * { text: "Question text", answers: ["A","B","C","D"], timestamp: 0 } -- always 4 answers.
 * "timestamp" is the point (in seconds) in public/video.webm that this question corresponds to.
 *
 * Put your video file at: public/video.webm
 */
const QUESTIONS = [
  { text: "Աղջիկ ունեմ, նազ նազենի", answers: ["I have a daughter, delicate and graceful", "I have a daughter, tender and elegant.", "I have a daughter, she's so modest and charming.", "My daughter is gentle and graceful"], timestamp: 171 },
  { text: "Սազը ձեռքիդ, գովա՛-գովա՛, մենք չգիտենք՝ աղջիկդ ո՞վ ա", answers: ["With the saz in your hand, you keep praising and praising — as if we don't know who your daughter is.", "Go on, praise her to the skies, don't we know who she is?", "Lute in hand, singing your praises — but don't we already know who your daughter is?", "Saz in hand, singing your praises — but don't we already know who your daughter is?"], timestamp: 188 },
  { text: "Տաշի", answers: ["Tashi", "Չի թարգմանվել", "Hey!", "Woohoo!"], timestamp: 325 },
  { text: "Բարով նստեք, Աստված վկա", answers: ["Be welcome and seated in good fortune — I swear to God.", "Be welcome and seated in good fortune․", "Welcome, sit with blessings — as God is my witness.", "Go ahead, enjoy your seat!"], timestamp: 876 },
  { text: "Տեսեք ոնց է բախտս բերել", answers: ["Look how lucky I've been!", "See how fortune has smiled on me!", "Look at how luck has favored me!", "See what a lucky man I am!"], timestamp: 920 },
  { text: "Հեյ, գինեգործ, աղա՛-ախպե՛ր", answers: ["Hey, winemaker, my Noble friend.", "Hey there, vintner, my good brother!", "Hey, winemaker — brother, my friend!", "Hey, winemaker, dear brother!"], timestamp: 945 },
  { text: "Մորքո՛ւր, եկա՞ր, գալդ բարի", answers: ["Auntie, you've come? Welcome!", "Dear auntie, welcome, welcome!", "Auntie, so you've come — welcome to you!", "Aunt, have you arrived? Good to have you here!"], timestamp: 1006 },
  { text: "Այ մեր գժվար, էս բզեզ ա, որ մի զարկեմ նա կսատկե", answers: ["Oh my, this bug is so tiny — I can kill it with one hit!", "Mother-in-law, lost your mind? It's just a bug. It will die with one hit.", "Mother-in-law, lost your? It's just a fly. I can kill her from the first try.", "Mother-in-law, lost your mind? It's just a bug. It will die on its own."], timestamp: 1015 },
  { text: "Այ մեր, մի՛ լաց, քանի ես կամ, Հուռիիս համար հոգիս կտամ", answers: ["Oh dear, don't cry — while I'm alive, I'll protect Huri with my life.","Dear mother-in-law, don't you cry, I'll do anything for Huri.","Oh dear, don't worry — as long as I'm here, Huri will never cry.","Oh dear mother-in-law, stop crying — as long as I live, my soul belongs to Huri alone."], timestamp: 1076 },
  { text: "Մատը մատին չի զարկելու", answers: ["She won't have to work a day in her life.","She'll never have to lift a hand for anything.","She won't do the smallest bit of work.","She won't even lift a finger."], timestamp: 1076 },

];

const ADMIN_PASSWORD = "2244";
const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f"]; // for the 4 buttons

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---- views + static assets ----
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"))); // serves /video.webm etc.

// ---- state ----
let currentQuestion = 0;
let votes = [0, 0, 0, 0];
let votedClients = new Set(); // clientIds who voted on current question
const adminTokens = new Set();

function resetVotes() {
  votes = [0, 0, 0, 0];
  votedClients = new Set();
}

function broadcastQuestion() {
  io.emit("questionChanged", {
    index: currentQuestion,
    total: QUESTIONS.length,
    text: QUESTIONS[currentQuestion].text,
    answers: QUESTIONS[currentQuestion].answers,
    timestamp: QUESTIONS[currentQuestion].timestamp,
  });
}

function broadcastStats() {
  io.to("admins").emit("stats", { votes });
}

// ---- voter cookie ----
app.use((req, res, next) => {
  if (!req.cookies.cid) {
    const cid = crypto.randomUUID();
    res.cookie("cid", cid, { maxAge: 1000 * 60 * 60 * 24 * 365 });
    req.cookies.cid = cid;
  }
  next();
});

// ---- / : voter page ----
app.get("/", (req, res) => {
res.send(`<!doctype html><html><head><meta charset="utf-8">
 <title>Քվեարկություն</title>
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <style>
   body{font-family:sans-serif;text-align:center;padding:40px 16px;background:#f5f5f5}
   button{width:80%;max-width:320px;padding:20px;margin:8px auto;display:block;
     font-size:18px;color:#fff;border:none;border-radius:8px;cursor:pointer;
     transition:opacity .2s ease, box-shadow .2s ease, transform .2s ease}
   button:disabled{opacity:.4;cursor:default}
   button.voted{opacity:1;box-shadow:0 0 0 3px #fff, 0 0 0 6px rgba(0,0,0,.35);transform:scale(1.02)}
   #msg{margin-top:20px;font-weight:bold}
 </style></head><body>
 <h3 id="q">Ընտրեք Ձեր կարծիքով լավագույն թարգմանությունը</h3>
 <div id="btns"></div>
 <div id="msg"></div>
 <script src="/socket.io/socket.io.js"></script>
 <script>
   const colors = ${JSON.stringify(COLORS)};
   let voted = false;
   let votedIndex = -1;
   const btns = document.getElementById('btns');
   const msg = document.getElementById('msg');

   function render(answers){
     btns.innerHTML = '';
     answers.forEach((label, i) => {
       const b = document.createElement('button');
       b.textContent = (voted && i === votedIndex ? '✓ ' : '') + label;
       b.style.background = colors[i];
       b.disabled = voted;
       if (voted && i === votedIndex) b.classList.add('voted');
       b.onclick = () => vote(i);
       btns.appendChild(b);
     });
   }

   function vote(i){
     fetch('/vote', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({choice:i})})
       .then(r => r.json()).then(d => {
         if(d.ok){
           voted = true;
           votedIndex = i;
           msg.textContent = 'Շնորհակալություն!';
           render(currentAnswers);
         } else {
           msg.textContent = d.error;
         }
       });
   }

   const socket = io();
   let currentAnswers = [];
   socket.on('questionChanged', (q) => {
     voted = false;
     votedIndex = -1;
     msg.textContent = '';
     currentAnswers = q.answers;
     render(q.answers);
   });

   fetch('/state').then(r=>r.json()).then(q=>{
     voted = q.alreadyVoted;
     votedIndex = typeof q.votedIndex === 'number' ? q.votedIndex : -1;
     currentAnswers = q.answers;
     render(q.answers);
     if(voted) msg.textContent = 'Շնորհակալություն!';
   });
 </script>
 </body></html>`);
});

app.get("/state", (req, res) => {
  res.json({
    answers: QUESTIONS[currentQuestion].answers,
    alreadyVoted: votedClients.has(req.cookies.cid),
  });
});

app.post("/vote", (req, res) => {
  const choice = Number(req.body.choice);
  const cid = req.cookies.cid;
  if (![0, 1, 2, 3].includes(choice)) return res.json({ ok: false, error: "Invalid choice" });
  if (votedClients.has(cid)) return res.json({ ok: false, error: "You already voted" });
  votedClients.add(cid);
  votes[choice]++;
  broadcastStats();
  res.json({ ok: true });
});

// ---- /admin ----
function isAdmin(req) {
  return req.cookies.admin_token && adminTokens.has(req.cookies.admin_token);
}

app.get("/admin", (req, res) => {
  if (!isAdmin(req)) {
    return res.send(`<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding:60px">
      <h2>Admin Login</h2>
      <form method="POST" action="/admin/login">
        <input type="password" name="password" placeholder="Password" />
        <button type="submit">Enter</button>
      </form>
      </body></html>`);
  }
  res.render("admin", {
    questions: QUESTIONS,
    colors: COLORS,
    currentIndex: currentQuestion,
    votes,
  });
});

app.post("/admin/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    const token = crypto.randomUUID();
    adminTokens.add(token);
    res.cookie("admin_token", token, { httpOnly: true });
    return res.redirect("/admin");
  }
  res.send('<p style="font-family:sans-serif;text-align:center">Wrong password. <a href="/admin">Try again</a></p>');
});

app.get("/admin/state", (req, res) => {
  if (!isAdmin(req)) return res.status(403).end();
  res.json({
    index: currentQuestion,
    total: QUESTIONS.length,
    text: QUESTIONS[currentQuestion].text,
    answers: QUESTIONS[currentQuestion].answers,
    timestamp: QUESTIONS[currentQuestion].timestamp,
    votes,
  });
});

app.post("/admin/next", (req, res) => {
  if (!isAdmin(req)) return res.status(403).end();
  currentQuestion = (currentQuestion + 1) % QUESTIONS.length;
  resetVotes();
  broadcastQuestion();
  res.json({ ok: true });
});

app.post("/admin/prev", (req, res) => {
  if (!isAdmin(req)) return res.status(403).end();
  currentQuestion = (currentQuestion - 1 + QUESTIONS.length) % QUESTIONS.length;
  resetVotes();
  broadcastQuestion();
  res.json({ ok: true });
});

// ---- sockets ----
io.on("connection", (socket) => {
  socket.on("joinAdmin", () => socket.join("admins"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));