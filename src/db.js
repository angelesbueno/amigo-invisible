'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function resetDb() {
  if (db) { try { db.close(); } catch (e) {} }
  db = null;
}

function obtenerDb() {
  if (!db) {
    const dbPath = process.env.TEST_DB_PATH
      || (process.env.NODE_ENV === 'production' ? '/data/db.sqlite' : path.join(__dirname, '..', 'db.sqlite'));
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    inicializarEsquema(db);
  }
  return db;
}

function inicializarEsquema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sorteos (
      id                TEXT PRIMARY KEY,
      nombre            TEXT NOT NULL,
      token_admin       TEXT NOT NULL UNIQUE,
      email_organizador TEXT NOT NULL,
      mensaje           TEXT,
      estado            TEXT NOT NULL DEFAULT 'pendiente',
      creado_en         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participantes (
      id        TEXT PRIMARY KEY,
      sorteo_id TEXT NOT NULL REFERENCES sorteos(id),
      nombre    TEXT NOT NULL,
      email     TEXT NOT NULL,
      token     TEXT UNIQUE,
      UNIQUE(sorteo_id, email)
    );

    CREATE TABLE IF NOT EXISTS exclusiones (
      id              TEXT PRIMARY KEY,
      sorteo_id       TEXT NOT NULL REFERENCES sorteos(id),
      participante_a  TEXT NOT NULL REFERENCES participantes(id),
      participante_b  TEXT NOT NULL REFERENCES participantes(id),
      UNIQUE(sorteo_id, participante_a, participante_b)
    );

    CREATE TABLE IF NOT EXISTS asignaciones (
      id           TEXT PRIMARY KEY,
      sorteo_id    TEXT NOT NULL REFERENCES sorteos(id),
      regalador_id TEXT NOT NULL UNIQUE REFERENCES participantes(id),
      receptor_id  TEXT NOT NULL REFERENCES participantes(id)
    );
  `);
}

module.exports = { obtenerDb, resetDb };
