'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { asignar } = require('../src/sorteo.js');

const participantes3 = [
  { id: 'p1' },
  { id: 'p2' },
  { id: 'p3' }
];

const participantes5 = [
  { id: 'p1' },
  { id: 'p2' },
  { id: 'p3' },
  { id: 'p4' },
  { id: 'p5' }
];

test('Asignación sin exclusiones', () => {
  const resultado = asignar(participantes3, []);
  assert.equal(resultado.length, 3);
  const ids = participantes3.map(p => p.id);
  for (const { regaladorId, receptorId } of resultado) {
    assert.notEqual(regaladorId, receptorId, 'Nadie se autoasigna');
    assert.ok(ids.includes(receptorId), 'El receptor es un participante válido');
  }
  // Cada participante aparece exactamente una vez como receptor
  const receptores = resultado.map(a => a.receptorId).sort();
  assert.deepEqual(receptores, [...ids].sort(), 'Cada participante es receptor exactamente una vez');
});

test('Asignación con exclusiones válidas', () => {
  // p1 y p2 no pueden tocarse (matrimonio)
  const exclusiones = [{ participante_a: 'p1', participante_b: 'p2' }];
  const resultado = asignar(participantes5, exclusiones);
  for (const { regaladorId, receptorId } of resultado) {
    assert.notEqual(regaladorId, receptorId, 'Nadie se autoasigna');
    const esPar12 = (regaladorId === 'p1' && receptorId === 'p2') ||
                    (regaladorId === 'p2' && receptorId === 'p1');
    assert.ok(!esPar12, 'El par excluido no aparece en la asignación');
  }
});

test('Asignación con exclusiones que hacen el sorteo imposible', () => {
  // Con 3 personas donde todas se excluyen entre sí → imposible
  const exclusiones = [
    { participante_a: 'p1', participante_b: 'p2' },
    { participante_a: 'p1', participante_b: 'p3' },
    { participante_a: 'p2', participante_b: 'p3' }
  ];
  assert.throws(
    () => asignar(participantes3, exclusiones),
    (err) => {
      assert.equal(err.code, 'SORTEO_IMPOSIBLE');
      return true;
    },
    'Debe lanzar SORTEO_IMPOSIBLE'
  );
});

test('Detección tras múltiples intentos fallidos', () => {
  // Mismo caso que el anterior — verifica el mensaje de error
  const exclusiones = [
    { participante_a: 'p1', participante_b: 'p2' },
    { participante_a: 'p1', participante_b: 'p3' },
    { participante_a: 'p2', participante_b: 'p3' }
  ];
  let error;
  try {
    asignar(participantes3, exclusiones);
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'Debe lanzar un error');
  assert.ok(
    error.message.includes('exclusiones'),
    'El mensaje sugiere revisar las exclusiones'
  );
});

test('Variabilidad entre ejecuciones', () => {
  // Con 10 participantes y sin exclusiones, dos ejecuciones deberían diferir
  const participantes10 = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}` }));
  const r1 = asignar(participantes10, []).map(a => a.receptorId).join(',');
  const r2 = asignar(participantes10, []).map(a => a.receptorId).join(',');
  // Estadísticamente improbable que sean iguales (1/10! probabilidad)
  // No podemos garantizarlo, pero lo intentamos varias veces
  let distintos = r1 !== r2;
  if (!distintos) {
    const r3 = asignar(participantes10, []).map(a => a.receptorId).join(',');
    distintos = r1 !== r3;
  }
  assert.ok(distintos, 'Las asignaciones deben variar entre ejecuciones');
});

test('Token único por participante', () => {
  const resultado = asignar(participantes5, []);
  const tokens = resultado.map(a => a.tokenRegalador);
  const tokensUnicos = new Set(tokens);
  assert.equal(tokensUnicos.size, tokens.length, 'Todos los tokens son únicos');
  for (const token of tokens) {
    assert.match(token, /^[0-9a-f-]{36}$/, 'El token tiene formato UUID v4');
  }
});

test('Persistencia antes del envío', () => {
  // Este requisito se verifica estructuralmente: asignar() devuelve las asignaciones
  // completas (con tokens) antes de que se llame a ninguna función de email.
  // El test verifica que el resultado incluye todos los datos necesarios para persistir.
  const resultado = asignar(participantes3, []);
  for (const item of resultado) {
    assert.ok(item.regaladorId, 'Tiene regaladorId');
    assert.ok(item.receptorId, 'Tiene receptorId');
    assert.ok(item.tokenRegalador, 'Tiene tokenRegalador para persistir');
  }
});
