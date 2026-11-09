'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { obtenerDb } = require('../src/db.js');

const llamadasEmail = [];
const emailMock = {
  enviarEmailAdmin: async (opts) => { llamadasEmail.push({ tipo: 'admin', ...opts }); },
  enviarEmailParticipante: async (opts) => { llamadasEmail.push({ tipo: 'participante', ...opts }); }
};
require.cache[require.resolve('../src/email.js')] = {
  id: require.resolve('../src/email.js'),
  filename: require.resolve('../src/email.js'),
  loaded: true, exports: emailMock
};

process.env.TEST_DB_PATH = require('path').join(__dirname, '..', 'db_test_email.sqlite');
process.env.ADMIN_SECRET = 'clave-email-test';
process.env.PORT = '3101';
process.env.BASE_URL = 'http://localhost:3101';

const { resetDb } = require('../src/db.js');
resetDb();
const app = require('../server.js');
let servidor, tokenAdmin, tokenParticipante;

before((_, done) => { servidor = app.listen(3101, done); });

after(() => {
  servidor.close();
  resetDb();
  const fs = require('fs'), dbFile = process.env.TEST_DB_PATH;
  if (dbFile && fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
});

async function api(method, path, body) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 3101, path: `/api${path}`, method, headers: { 'Content-Type': 'application/json' } },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') })); }
    );
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('Email de acceso admin enviado al crear sorteo', async () => {
  llamadasEmail.length = 0;
  const r = await api('POST', '/sorteos', { nombre: 'Email Test', email_organizador: 'org@test.com', admin_secret: 'clave-email-test' });
  assert.equal(r.status, 201);
  tokenAdmin = r.body.token_admin;
  const e = llamadasEmail.find(e => e.tipo === 'admin');
  assert.ok(e, 'Se debe enviar email al organizador al crear');
  assert.equal(e.emailOrganizador, 'org@test.com');
  assert.ok(e.urlAdmin.includes(tokenAdmin), 'El email contiene la URL de admin');
});

test('El email de acceso admin no revela asignaciones', async () => {
  const e = llamadasEmail.find(e => e.tipo === 'admin');
  assert.ok(e);
  assert.ok(!e.receptor, 'No debe contener receptor');
  assert.ok(!e.asignaciones, 'No debe contener asignaciones');
});

test('Envio exitoso a todos los participantes', async () => {
  llamadasEmail.length = 0;
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Ana', email: 'ana@test.com' });
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Luis', email: 'luis@test.com' });
  await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Maria', email: 'maria@test.com' });
  const r = await api('POST', `/admin/${tokenAdmin}/lanzar`, {});
  assert.equal(r.status, 200);
  const emails = llamadasEmail.filter(e => e.tipo === 'participante');
  assert.equal(emails.length, 3, 'Se deben enviar 3 emails');
});

test('Email recibido por el participante', async () => {
  const emails = llamadasEmail.filter(e => e.tipo === 'participante');
  for (const e of emails) {
    assert.ok(e.nombre, 'Tiene nombre del participante');
    assert.ok(e.nombreSorteo, 'Tiene nombre del sorteo');
    assert.ok(e.token, 'Tiene token unico');
    assert.ok(!e.receptor, 'NO revela el receptor');
  }
  tokenParticipante = emails[0].token;
});

test('Enlace del email lleva al resultado correcto', async () => {
  const r = await api('GET', `/resultado/${tokenParticipante}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'lanzado');
  assert.ok(r.body.receptor);
});

test('Sin email de resultados al organizador', async () => {
  const emailsAdmin = llamadasEmail.filter(e => e.tipo === 'admin');
  for (const e of emailsAdmin) {
    assert.ok(!e.asignaciones, 'No contiene asignaciones');
    assert.ok(!e.receptor, 'No revela receptores');
  }
});

test('Reenvio en sorteo no lanzado', async () => {
  const r0 = await api('POST', '/sorteos', { nombre: 'No Lanzado', email_organizador: 'x@test.com', admin_secret: 'clave-email-test' });
  const ta = r0.body.token_admin;
  const rp = await api('POST', `/admin/${ta}/participantes`, { nombre: 'Solo', email: 'solo@test.com' });
  const r = await api('POST', `/admin/${ta}/reenviar/${rp.body.id}`, {});
  assert.equal(r.status, 400);
  assert.ok(r.body.error.includes('lanzado'));
});

test('Reenvio exitoso', async () => {
  llamadasEmail.length = 0;
  const db = obtenerDb();
  const participante = db.prepare('SELECT * FROM participantes WHERE token IS NOT NULL LIMIT 1').get();
  const sorteo = db.prepare('SELECT * FROM sorteos WHERE id = ?').get(participante.sorteo_id);
  const r = await api('POST', `/admin/${sorteo.token_admin}/reenviar/${participante.id}`, {});
  assert.equal(r.status, 200);
  assert.ok(r.body.ok);
  const reenvio = llamadasEmail.find(e => e.tipo === 'participante');
  assert.ok(reenvio, 'Se debe enviar el email de reenvio');
  assert.equal(reenvio.token, participante.token, 'El token no cambia en el reenvio');
});

test('Fallo de envio en uno o mas participantes', async () => {
  let falloCount = 0;
  const emailMockFallido = {
    enviarEmailAdmin: async () => {},
    enviarEmailParticipante: async (opts) => {
      falloCount++;
      if (falloCount === 1) throw new Error('Error SMTP simulado');
      llamadasEmail.push({ tipo: 'participante', ...opts });
    }
  };
  require.cache[require.resolve('../src/email.js')].exports = emailMockFallido;
  const r0 = await api('POST', '/sorteos', { nombre: 'Fallo Email', email_organizador: 'f@test.com', admin_secret: 'clave-email-test' });
  const ta = r0.body.token_admin;
  await api('POST', `/admin/${ta}/participantes`, { nombre: 'P1', email: 'p1@test.com' });
  await api('POST', `/admin/${ta}/participantes`, { nombre: 'P2', email: 'p2@test.com' });
  await api('POST', `/admin/${ta}/participantes`, { nombre: 'P3', email: 'p3@test.com' });
  const r = await api('POST', `/admin/${ta}/lanzar`, {});
  assert.equal(r.status, 200, 'El sorteo se marca lanzado aunque falle un email');
  assert.equal(r.body.estado, 'lanzado');
  require.cache[require.resolve('../src/email.js')].exports = emailMock;
});
