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

process.env.TEST_DB_PATH = require('path').join(__dirname, '..', 'db_test_priv.sqlite');
process.env.ADMIN_SECRET = 'clave-priv-test';
process.env.PORT = '3103';
process.env.BASE_URL = 'http://localhost:3103';

const { resetDb } = require('../src/db.js');
resetDb();
const app = require('../server.js');
let servidor, tokenAdmin, tokenParticipante;

async function api(method, path, body) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 3103, path: `/api${path}`, method, headers: { 'Content-Type': 'application/json' } },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') })); }
    );
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

before(async () => {
  await new Promise((resolve) => { servidor = app.listen(3103, resolve); });
  const r = await api('POST', '/sorteos', { nombre: 'Privacidad Test', email_organizador: 'org@test.com', admin_secret: 'clave-priv-test' });
  tokenAdmin = r.body.token_admin;
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Ana', email: 'ana@test.com' });
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Luis', email: 'luis@test.com' });
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Maria', email: 'maria@test.com' });
  await api('POST', `/admin/${tokenAdmin}/lanzar`, {});
  const db = obtenerDb();
  const p = db.prepare('SELECT token FROM participantes WHERE token IS NOT NULL LIMIT 1').get();
  tokenParticipante = p.token;
});

after(() => {
  servidor.close();
  resetDb();
  const fs = require('fs'), dbFile = process.env.TEST_DB_PATH;
  if (dbFile && fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
});

test('Organizador consulta el panel tras lanzar el sorteo', async () => {
  const r = await api('GET', `/admin/${tokenAdmin}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'lanzado');
  // El panel NO debe contener asignaciones
  assert.ok(!r.body.asignaciones, 'No debe haber campo asignaciones en el panel');
  for (const p of r.body.participantes) {
    assert.ok(!p.receptor, 'Ningun participante debe tener campo receptor');
    assert.ok(!p.asignadoA, 'Ningun participante debe tener campo asignadoA');
  }
});

test('Organizador intenta acceder a la API de resultados', async () => {
  // El token_admin NO debe funcionar como token de participante
  const r = await api('GET', `/resultado/${tokenAdmin}`);
  assert.equal(r.status, 404, 'token_admin no debe funcionar en endpoint de participante');
});

test('Uso de token_admin en endpoint de participante', async () => {
  const r = await api('GET', `/resultado/${tokenAdmin}`);
  assert.equal(r.status, 404);
});

test('Uso de token de participante en panel de administracion', async () => {
  const r = await api('GET', `/admin/${tokenParticipante}`);
  assert.equal(r.status, 403);
});

test('Intento de obtener todas las asignaciones', async () => {
  // No existe endpoint de exportacion total — debe devolver 404
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 3103, path: '/api/asignaciones', method: 'GET' },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { assert.equal(res.statusCode, 404); resolve(); }); }
    );
    req.end();
  });
});

test('Log de acceso a vista de participante', async () => {
  // La ruta de resultado no expone el nombre del receptor en sus cabeceras de log
  // Verificamos que la respuesta JSON no incluye datos de otros participantes
  const r = await api('GET', `/resultado/${tokenParticipante}`);
  assert.equal(r.status, 200);
  // Solo debe haber UN receptor, no todos
  assert.ok(typeof r.body.receptor === 'string', 'El receptor es un string unico');
  assert.ok(!Array.isArray(r.body.receptor), 'No devuelve lista de receptores');
  assert.ok(!r.body.todasLasAsignaciones, 'No devuelve todas las asignaciones');
});
