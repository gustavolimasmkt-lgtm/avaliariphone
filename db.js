// db.js — schema SQLite + seed inicial.
// Segue o mesmo padrao das outras apps (better-sqlite3, sem ORM, migrations
// simples rodando no boot). Banco fica em data/app.db (monte um volume
// persistente do Railway nesse caminho, senao o banco some a cada deploy).

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "app.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      whatsapp TEXT,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'colaborador', -- 'owner' | 'colaborador'
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nome_fantasia TEXT DEFAULT '',
      razao_social TEXT DEFAULT '',
      cnpj TEXT DEFAULT '',
      endereco TEXT DEFAULT '',
      cidade TEXT DEFAULT '',
      uf TEXT DEFAULT '',
      cep TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      logo_path TEXT DEFAULT '',
      termo_texto_custom TEXT DEFAULT '',
      regras_texto TEXT DEFAULT '',
      bonus_valor REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base REAL NOT NULL DEFAULT 0,
      leves REAL NOT NULL DEFAULT 0,
      moderadas REAL NOT NULL DEFAULT 0,
      bateria REAL NOT NULL DEFAULT 0,
      tela REAL NOT NULL DEFAULT 0,
      traseira REAL NOT NULL DEFAULT 0,
      faceid REAL NOT NULL DEFAULT 0,
      doc_carga REAL NOT NULL DEFAULT 0,
      cam_traseira REAL NOT NULL DEFAULT 0,
      notif_camera REAL NOT NULL DEFAULT 0,
      notif_bateria REAL NOT NULL DEFAULT 0,
      notif_tela REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bandeiras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      sigla TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS taxas (
      bandeira_id INTEGER NOT NULL REFERENCES bandeiras(id) ON DELETE CASCADE,
      parcela TEXT NOT NULL, -- 'debito', '1x'..'21x'
      taxa REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (bandeira_id, parcela)
    );

    -- Nao guarda PII do cliente (nome/CPF/endereco/assinatura) de proposito:
    -- so o suficiente pra localizar o termo pelo IMEI depois. O PDF com os
    -- dados completos e gerado na hora e nao fica salvo no servidor.
    CREATE TABLE IF NOT EXISTS termos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imei TEXT NOT NULL,
      modelo TEXT DEFAULT '',
      valor_pago REAL DEFAULT 0,
      anatel_ok INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_termos_imei ON termos(imei);

    CREATE TABLE IF NOT EXISTS quote_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER,
      avarias TEXT NOT NULL DEFAULT '[]',
      bonus INTEGER NOT NULL DEFAULT 0,
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`INSERT OR IGNORE INTO store (id) VALUES (1);`);

  if (!db.prepare("SELECT 1 FROM store WHERE regras_texto != ''").get()) {
    db.prepare("UPDATE store SET regras_texto = ? WHERE id = 1").run(
      [
        "Doc de carga: só o técnico da loja diagnostica.",
        "Notificação de peça (peça ok, sem troca): descontar o valor da notificação.",
        "Notificação + ainda precisa trocar a peça: descontar a troca da peça x 1,5.",
        "Bônus na troca por outro seminovo do nosso estoque.",
      ].join("\n")
    );
  }
}

function seedModelsIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) c FROM models").get().c;
  if (count > 0) return;

  const seed = require("./data/seed-models.json");
  const insert = db.prepare(`
    INSERT INTO models
      (name, base, leves, moderadas, bateria, tela, traseira, faceid, doc_carga, cam_traseira, notif_camera, notif_bateria, notif_tela, sort_order)
    VALUES
      (@name, @base, @leves, @moderadas, @bateria, @tela, @traseira, @faceid, @doc_carga, @cam_traseira, @notif_camera, @notif_bateria, @notif_tela, @sort_order)
  `);
  const insertAll = db.transaction((rows) => {
    rows.forEach((m, i) => insert.run({ ...m, sort_order: i }));
  });
  insertAll(seed);
  console.log(`[db] seed: ${seed.length} modelos inseridos`);
}

function seedTaxasIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) c FROM bandeiras").get().c;
  if (count > 0) return;

  const seed = require("./data/seed-taxas.json");
  const insertBandeira = db.prepare(
    "INSERT INTO bandeiras (nome, sigla, sort_order) VALUES (?, ?, ?)"
  );
  const insertTaxa = db.prepare(
    "INSERT INTO taxas (bandeira_id, parcela, taxa) VALUES (?, ?, ?)"
  );
  const insertAll = db.transaction((data) => {
    data.bandeiras.forEach((b, i) => {
      const { lastInsertRowid } = insertBandeira.run(b.nome, b.sigla, i);
      data.parcelas.forEach((p, j) => {
        insertTaxa.run(lastInsertRowid, p, b.taxas[j] ?? 0);
      });
    });
  });
  insertAll(seed);
  console.log(`[db] seed: ${seed.bandeiras.length} bandeiras inseridas`);
}

function seedOwnerIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) c FROM users").get().c;
  if (count > 0) return;

  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME || "Dono";
  if (!email || !password) {
    console.warn(
      "[db] nenhum usuario cadastrado e OWNER_EMAIL/OWNER_PASSWORD nao configurados no ambiente. " +
        "Defina essas variaveis e reinicie pra criar a conta dona."
    );
    return;
  }
  const { hashPassword } = require("./lib/password");
  const { hash, salt } = hashPassword(password);
  db.prepare(
    "INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, 'owner')"
  ).run(name, email.toLowerCase().trim(), hash, salt);
  console.log(`[db] usuario dono criado: ${email}`);
}

migrate();
seedModelsIfEmpty();
seedTaxasIfEmpty();
seedOwnerIfEmpty();

module.exports = db;
