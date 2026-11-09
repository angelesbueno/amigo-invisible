'use strict';

const { v4: uuidv4 } = require('uuid');

const MAX_INTENTOS = 1000;

/**
 * Mezcla un array in-place usando Fisher-Yates.
 * @param {Array} arr
 * @returns {Array} el mismo array mezclado
 */
function mezclarFisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Construye el conjunto de pares excluidos en ambas direcciones.
 * @param {Array<{participante_a: string, participante_b: string}>} exclusiones
 * @returns {Set<string>} conjunto de claves "idA:idB" y "idB:idA"
 */
function construirPaiesExcluidos(exclusiones) {
  const pares = new Set();
  for (const ex of exclusiones) {
    pares.add(`${ex.participante_a}:${ex.participante_b}`);
    pares.add(`${ex.participante_b}:${ex.participante_a}`);
  }
  return pares;
}

/**
 * Verifica si una lista de asignaciones es válida.
 * @param {Array<{regaladorId: string, receptorId: string}>} asignaciones
 * @param {Set<string>} paresExcluidos
 * @returns {boolean}
 */
function esValida(asignaciones, paresExcluidos) {
  for (const { regaladorId, receptorId } of asignaciones) {
    if (regaladorId === receptorId) return false;
    if (paresExcluidos.has(`${regaladorId}:${receptorId}`)) return false;
  }
  return true;
}

/**
 * Realiza el sorteo de Amigo Invisible con restricciones.
 * @param {Array<{id: string}>} participantes - lista de participantes
 * @param {Array<{participante_a: string, participante_b: string}>} exclusiones
 * @returns {Array<{regaladorId: string, receptorId: string, tokenRegalador: string}>}
 * @throws {Error} con code 'SORTEO_IMPOSIBLE' si no converge
 */
function asignar(participantes, exclusiones) {
  if (participantes.length < 3) {
    const err = new Error('Se necesitan al menos 3 participantes para realizar el sorteo.');
    err.code = 'PARTICIPANTES_INSUFICIENTES';
    throw err;
  }

  const paresExcluidos = construirPaiesExcluidos(exclusiones);
  const ids = participantes.map(p => p.id);

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const receptores = mezclarFisherYates([...ids]);
    const asignaciones = ids.map((regaladorId, i) => ({
      regaladorId,
      receptorId: receptores[i]
    }));

    if (esValida(asignaciones, paresExcluidos)) {
      // Generar tokens únicos para cada participante
      return asignaciones.map(a => ({
        ...a,
        tokenRegalador: uuidv4()
      }));
    }
  }

  const err = new Error(
    'No fue posible realizar el sorteo con las exclusiones actuales. '
    + 'Revisa las exclusiones e inténtalo de nuevo.'
  );
  err.code = 'SORTEO_IMPOSIBLE';
  throw err;
}

module.exports = { asignar };
