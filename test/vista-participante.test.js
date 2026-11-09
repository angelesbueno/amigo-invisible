'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { obtenerDb } = require('../src/db.js');

const emailMock = { enviarEmailAdmin: async () => {}, enviarEmailParticipante: async () => {} };
require.cache[require.resolve('../src/email.js')] = {
  id: require.resolve('../src/email.js'),
  filename: require.resolve('../src/email.js'),
  loaded: true, exports: emailMock
};

process.env.TEST_DB_PATH = require('path').join(__dirname, '..', 'db_test_vista.sqlite');
process.env.ADMIN_SECRET = 'clave-vista-test';
process.env.PORT = '3102';
process.env.BASE_URL = 'http://localhost:3102';

const { resetDb } = require('../src/db.js');
resetDb();
const app = require('../server.js');
let servidor;
let tokenParticipante;
let tokenAdmin;

async function api(method, path, body) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 3102, path: `/api${path}`, method, headers: { 'Content-Type': 'application/json' } },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') })); }
    );
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

before(async () => {
  await new Promise((resolve) => { servidor = app.listen(3102, resolve); });
  const r = await api('POST', '/sorteos', { nombre: 'Vista Test', email_organizador: 'org@test.com', admin_secret: 'clave-vista-test' });
  tokenAdmin = r.body.token_admin;
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Ana', email: 'ana@test.com' });
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Luis', email: 'luis@test.com' });
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Maria', email: 'maria@test.com' });
  await api('POST', `/admin/${tokenAdmin}/lanzar`, {});
  const { obtenerDb } = require('../src/db.js');
  const p = obtenerDb().prepare('SELECT token FROM participantes WHERE token IS NOT NULL LIMIT 1').get();
  tokenParticipante = p.token;
});

after(() => {
  servidor.close();
  resetDb();
  const fs = require('fs'), dbFile = process.env.TEST_DB_PATH;
  if (dbFile && fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
});

test('Token valido pero sorteo pendiente', async () => {
  // Crear sorteo pendiente con participante
  const r0 = await api('POST', '/sorteos', { nombre: 'Pendiente', email_organizador: 'p@test.com', admin_secret: 'clave-vista-test' });
  const ta = r0.body.token_admin;
  // Insertar un token manualmente en un participante pendiente para simular
  const db = obtenerDb();
  const { v4: uuidv4 } = require('uuid');
  const pid = uuidv4();
  const fakeToken = uuidv4();
  const sorteo = db.prepare('SELECT id FROM sorteos WHERE token_admin = ?').get(ta);
  db.prepare('INSERT INTO participantes (id, sorteo_id, nombre, email, token) VALUES (?, ?, ?, ?, ?)').run(pid, sorteo.id, 'Fake', 'fake@test.com', fakeToken);
  const r = await api('GET', `/resultado/${fakeToken}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'pendiente');
  assert.ok(!r.body.receptor, 'No debe revelar receptor si sorteo pendiente');
});

test('Token inexistente', async () => {
  const r = await api('GET', '/resultado/token-que-no-existe-xyz');
  assert.equal(r.status, 404);
  assert.ok(r.body.error, 'Debe devolver mensaje de error generico');
});

test('URL de resultado sin token', async () => {
  // GET /api/resultado/ sin token - Express no encuentra la ruta y devuelve 404
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 3102, path: '/api/resultado/', method: 'GET' },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          assert.ok(res.statusCode === 404 || res.statusCode === 400, `Esperado 404, recibido ${res.statusCode}`);
          resolve();
        });
      }
    );
    req.end();
  });
});

test('Acceso con token valido', async () => {
  const r = await api('GET', `/resultado/${tokenParticipante}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'lanzado');
  assert.ok(r.body.nombre, 'Muestra el nombre del participante');
  assert.ok(r.body.receptor, 'Muestra el nombre del receptor asignado');
  assert.ok(r.body.nombreSorteo, 'Muestra el nombre del sorteo');
});

test('Segunda visita con el mismo enlace', async () => {
  const r1 = await api('GET', `/resultado/${tokenParticipante}`);
  const r2 = await api('GET', `/resultado/${tokenParticipante}`);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(r1.body.receptor, r2.body.receptor, 'El resultado es el mismo en ambas visitas');
});

test('Resultado con mensaje personalizado', async () => {
  // Crear sorteo con mensaje y lanzarlo
  const r0 = await api('POST', '/sorteos', { nombre: 'Con Mensaje', email_organizador: 'msg@test.com', admin_secret: 'clave-vista-test' });
  const ta = r0.body.token_admin;
  await api('POST', `/admin/${ta}/participantes`, { nombre: 'P1', email: 'pm1@test.com' });
  await api('POST', `/admin/${ta}/participantes`, { nombre: 'P2', email: 'pm2@test.com' });
  await api('POST', `/admin/${ta}/participantes`, { nombre: 'P3', email: 'pm3@test.com' });
  await api('PATCH', `/admin/${ta}/mensaje`, { mensaje: 'Presupuesto: 30 euros' });
  await api('POST', `/admin/${ta}/lanzar`, {});
  const db = obtenerDb();
  const p = db.prepare('SELECT token FROM participantes WHERE token IS NOT NULL AND sorteo_id = (SELECT id FROM sorteos WHERE token_admin = ?)').get(ta);
  const r = await api('GET', `/resultado/${p.token}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.mensaje, 'Presupuesto: 30 euros');
});

test('Resultado sin mensaje personalizado', async () => {
  const r = await api('GET', `/resultado/${tokenParticipante}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.mensaje, null, 'Sin mensaje configurado, el campo es null');
});
