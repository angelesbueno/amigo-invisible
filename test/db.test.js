'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_TEST_PATH = path.join(__dirname, '..', 'db_test_db.sqlite');

// Reutilizamos la lógica de inicialización del esquema
function crearDbTest() {
  const db = new Database(DB_TEST_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
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
  return db;
}

let db;

before(() => {
  db = crearDbTest();
});

after(() => {
  db.close();
  if (fs.existsSync(DB_TEST_PATH)) fs.unlinkSync(DB_TEST_PATH);
});

test('Las 4 tablas existen tras la inicialización', () => {
  const tablas = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  ).all().map(r => r.name);
  assert.ok(tablas.includes('sorteos'), 'Tabla sorteos no existe');
  assert.ok(tablas.includes('participantes'), 'Tabla participantes no existe');
  assert.ok(tablas.includes('exclusiones'), 'Tabla exclusiones no existe');
  assert.ok(tablas.includes('asignaciones'), 'Tabla asignaciones no existe');
});

test('La tabla sorteos tiene los campos email_organizador y mensaje', () => {
  const columnas = db.prepare(`PRAGMA table_info(sorteos)`).all().map(c => c.name);
  assert.ok(columnas.includes('email_organizador'), 'Campo email_organizador no existe');
  assert.ok(columnas.includes('mensaje'), 'Campo mensaje no existe');
});

test('La restricción UNIQUE(sorteo_id, email) en participantes se cumple', () => {
  db.prepare(`INSERT INTO sorteos (id, nombre, token_admin, email_organizador, estado, creado_en)
    VALUES ('s1', 'Test', 'ta1', 'org@test.com', 'pendiente', '2026-01-01T00:00:00.000Z')`).run();
  db.prepare(`INSERT INTO participantes (id, sorteo_id, nombre, email)
    VALUES ('p1', 's1', 'Ana', 'ana@test.com')`).run();
  assert.throws(() => {
    db.prepare(`INSERT INTO participantes (id, sorteo_id, nombre, email)
      VALUES ('p2', 's1', 'Ana2', 'ana@test.com')`).run();
  }, /UNIQUE constraint failed/, 'Debería lanzar error por email duplicado en mismo sorteo');
});

test('La restricción UNIQUE en exclusiones se cumple (idempotente)', () => {
  db.prepare(`INSERT INTO participantes (id, sorteo_id, nombre, email)
    VALUES ('p3', 's1', 'Luis', 'luis@test.com')`).run();
  db.prepare(`INSERT INTO exclusiones (id, sorteo_id, participante_a, participante_b)
    VALUES ('e1', 's1', 'p1', 'p3')`).run();
  assert.throws(() => {
    db.prepare(`INSERT INTO exclusiones (id, sorteo_id, participante_a, participante_b)
      VALUES ('e2', 's1', 'p1', 'p3')`).run();
  }, /UNIQUE constraint failed/, 'Debería lanzar error por exclusión duplicada');
});
