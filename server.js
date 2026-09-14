// server.js — ponto de entrada. Monta as rotas, cuida de autenticacao e
// serve os arquivos estaticos (CSS + logo da loja).

require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const fs = require("fs");

const db = require("./db"); // roda migrate()/seed() so de importar
const { attachUser, requireLogin, requireOwner } = require("./middleware/auth");

const app = express();
app.disable("x-powered-by");

app.use(cookieParser());
app.use(attachUser);

app.use("/style.css", express.static(path.join(__dirname, "public", "style.css")));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

// login/logout (sem exigir sessao)
app.use(require("./routes/auth"));

// tudo daqui pra baixo exige login
app.use(requireLogin);

// acessivel a qualquer usuario logado (dono ou colaborador)
app.use(require("./routes/cotacao"));
app.use(require("./routes/calculadora"));

// exclusivo do dono
app.use(requireOwner);
app.use(require("./routes/precos"));
app.use(require("./routes/taxas"));
app.use(require("./routes/loja"));
app.use(require("./routes/equipe"));
app.use(require("./routes/termos"));

app.use((req, res) => res.status(404).send("Pagina nao encontrada."));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Erro interno. Confira os logs do servidor.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] Avalia iPhone (interno) rodando na porta ${PORT}`);
});
