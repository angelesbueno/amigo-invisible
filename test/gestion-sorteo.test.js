'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { obtenerDb } = require('../src/db.js');

// Mock email para no hacer llamadas reales a Resend
const emailMock = { enviarEmailAdmin: async () => {}, enviarEmailParticipante: async () => {} };
require.cache[require.resolve('../src/email.js')] = {
  id: require.resolve('../src/email.js'),
  filename: require.resolve('../src/email.js'),
  loaded: true,
  exports: emailMock
};

process.env.TEST_DB_PATH = require('path').join(__dirname, '..', 'db_test_gestion.sqlite');
process.env.ADMIN_SECRET = 'clave-test';
process.env.PORT = '3099';
process.env.BASE_URL = 'http://localhost:3099';

const { resetDb } = require('../src/db.js');
resetDb();
const app = require('../server.js');

let servidor;
let tokenAdmin;
let participanteId1, participanteId2, participanteId3;

before((_, done) => { servidor = app.listen(3099, done); });

after(() => {
  servidor.close();
  resetDb();
  const fs = require('fs');
  const dbFile = process.env.TEST_DB_PATH;
  if (dbFile && fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
});

async function api(method, path, body) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 3099, path: `/api${path}`, method, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }));
      }
    );
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('Crear sorteo con nombre vacío', async () => {
  const r = await api('POST', '/sorteos', { nombre: '', email_organizador: 'org@test.com', admin_secret: 'clave-test' });
  assert.equal(r.status, 400);
});

test('Crear sorteo con clave de administrador incorrecta', async () => {
  const r = await api('POST', '/sorteos', { nombre: 'Test', email_organizador: 'org@test.com', admin_secret: 'mala' });
  assert.equal(r.status, 403);
});

test('Crear sorteo con datos válidos', async () => {
  const r = await api('POST', '/sorteos', { nombre: 'Navidad 2026', email_organizador: 'org@test.com', admin_secret: 'clave-test' });
  assert.equal(r.status, 201);
  assert.ok(r.body.token_admin);
  assert.equal(r.body.estado, 'pendiente');
  tokenAdmin = r.body.token_admin;
});

test('Acceso con token_admin válido', async () => {
  const r = await api('GET', `/admin/${tokenAdmin}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.nombre, 'Navidad 2026');
});

test('Acceso sin token o con token inválido', async () => {
  const r = await api('GET', '/admin/token-invalido-xyz');
  assert.equal(r.status, 403);
});

test('Añadir participante con datos válidos', async () => {
  const r1 = await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Ana', email: 'ana@test.com' });
  assert.equal(r1.status, 201);
  participanteId1 = r1.body.id;
  const r2 = await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Luis', email: 'luis@test.com' });
  participanteId2 = r2.body.id;
  const r3 = await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'María', email: 'maria@test.com' });
  participanteId3 = r3.body.id;
});

test('Añadir participante con email duplicado', async () => {
  const r = await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Ana2', email: 'ana@test.com' });
  assert.equal(r.status, 400);
});

test('Eliminar participante en sorteo pendiente', async () => {
  const r0 = await api('POST', '/sorteos', { nombre: 'Del Test', email_organizador: 'del@test.com', admin_secret: 'clave-test' });
  const ta = r0.body.token_admin;
  const rp = await api('POST', `/admin/${ta}/participantes`, { nombre: 'Borrar', email: 'borrar@test.com' });
  const r = await api('DELETE', `/admin/${ta}/participantes/${rp.body.id}`);
  assert.equal(r.status, 204);
});

test('Definir exclusion valida', async () => {
  const r = await api('POST', `/admin/${tokenAdmin}/exclusiones`, { participante_a: participanteId1, participante_b: participanteId2 });
  assert.ok(r.status === 200 || r.status === 201);
  assert.ok(r.body.id);
});

test('Excluir participante consigo mismo', async () => {
  const r = await api('POST', `/admin/${tokenAdmin}/exclusiones`, { participante_a: participanteId1, participante_b: participanteId1 });
  assert.equal(r.status, 400);
});

test('Exclusion duplicada', async () => {
  const r = await api('POST', `/admin/${tokenAdmin}/exclusiones`, { participante_a: participanteId1, participante_b: participanteId2 });
  assert.ok(r.status === 200 || r.status === 201);
});

test('Eliminar exclusion existente', async () => {
  const r1 = await api('POST', `/admin/${tokenAdmin}/exclusiones`, { participante_a: participanteId2, participante_b: participanteId3 });
  const exId = r1.body.id;
  const r2 = await api('DELETE', `/admin/${tokenAdmin}/exclusiones/${exId}`);
  assert.equal(r2.status, 204);
});

test('Anadir mensaje personalizado', async () => {
  const r = await api('PATCH', `/admin/${tokenAdmin}/mensaje`, { mensaje: 'Presupuesto: 30 euros' });
  assert.equal(r.status, 200);
  assert.equal(r.body.mensaje, 'Presupuesto: 30 euros');
});

test('Mensaje vacio elimina el mensaje existente', async () => {
  const r = await api('PATCH', `/admin/${tokenAdmin}/mensaje`, { mensaje: '' });
  assert.equal(r.status, 200);
  assert.equal(r.body.mensaje, null);
});

test('Mensaje demasiado largo', async () => {
  const r = await api('PATCH', `/admin/${tokenAdmin}/mensaje`, { mensaje: 'x'.repeat(501) });
  assert.equal(r.status, 400);
});

test('Lanzar sorteo con menos de 3 participantes', async () => {
  const r0 = await api('POST', '/sorteos', { nombre: 'Mini', email_organizador: 'mini@test.com', admin_secret: 'clave-test' });
  const ta = r0.body.token_admin;
  await api('POST', `/admin/${ta}/participantes`, { nombre: 'Solo', email: 'solo@test.com' });
  const r = await api('POST', `/admin/${ta}/lanzar`, {});
  assert.equal(r.status, 400);
  assert.ok(r.body.error.includes('3'));
});

test('Lanzar sorteo con suficientes participantes', async () => {
  // Eliminar exclusion restante para que el sorteo sea posible con 3 personas
  const panel = await api('GET', `/admin/${tokenAdmin}`);
  for (const ex of panel.body.exclusiones) {
    await api('DELETE', `/admin/${tokenAdmin}/exclusiones/${ex.id}`);
  }
  const r = await api('POST', `/admin/${tokenAdmin}/lanzar`, {});
  assert.equal(r.status, 200, `Error inesperado: ${JSON.stringify(r.body)}`);
  assert.equal(r.body.estado, 'lanzado');
});

test('Lanzar sorteo ya lanzado', async () => {
  const r = await api('POST', `/admin/${tokenAdmin}/lanzar`, {});
  assert.equal(r.status, 400);
  assert.ok(r.body.error.includes('lanzado'));
});

test('Anadir participante a sorteo ya lanzado', async () => {
  const r = await api('POST', `/admin/${tokenAdmin}/participantes`, { nombre: 'Tarde', email: 'tarde@test.com' });
  assert.equal(r.status, 400);
  assert.ok(r.body.error.includes('lanzado'));
});
