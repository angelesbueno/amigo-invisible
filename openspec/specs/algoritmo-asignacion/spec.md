# algoritmo-asignacion Specification

## Purpose

Define el comportamiento observable del sorteo aleatorio con restricciones: qué garantías ofrece la asignación resultante, cómo se detecta un sorteo imposible y cómo se generan los tokens únicos de acceso para cada participante.

## Requirements

### Requirement: Asignación válida
El algoritmo de asignación MUST producir una permutación del conjunto de participantes tal que:
1. Ningún participante se asigna a sí mismo.
2. Ningún par excluido (A, B) aparece en la asignación en ninguna dirección (ni A→B ni B→A).
3. Cada participante es exactamente el receptor de exactamente un regalador.

#### Scenario: Asignación sin exclusiones
- **WHEN** se lanza el sorteo con N participantes y sin exclusiones (N ≥ 3)
- **THEN** el sistema produce una asignación donde cada participante tiene exactamente un receptor distinto a sí mismo

#### Scenario: Asignación con exclusiones válidas
- **WHEN** se lanza el sorteo con exclusiones que no impiden una asignación válida
- **THEN** el sistema produce una asignación que respeta todas las exclusiones declaradas

#### Scenario: Asignación con exclusiones que hacen el sorteo imposible
- **WHEN** las exclusiones hacen matemáticamente imposible encontrar una asignación válida
- **THEN** el sistema NO lanza el sorteo, mantiene el estado `pendiente` y devuelve un mensaje de error indicando que las exclusiones impiden el sorteo

### Requirement: Detección de sorteo imposible
El sistema MUST detectar antes de confirmar el sorteo que las exclusiones configuradas imposibilitan una asignación válida. En ese caso MUST informar al organizador sin modificar el estado del sorteo ni enviar ningún email.

#### Scenario: Detección tras múltiples intentos fallidos
- **WHEN** el algoritmo no encuentra una asignación válida tras el número máximo de intentos configurado
- **THEN** el sistema devuelve un error indicando que no fue posible realizar el sorteo con las exclusiones actuales, sugiriendo al organizador que revise las exclusiones

### Requirement: Aleatoriedad de la asignación
El algoritmo MUST producir asignaciones diferentes en distintas ejecuciones sobre el mismo conjunto de participantes y exclusiones (es decir, no MUST ser determinista). No se requiere una fuente de aleatoriedad criptográfica; la aleatoriedad del runtime de Node.js (Math.random) es suficiente.

#### Scenario: Variabilidad entre ejecuciones
- **WHEN** se ejecuta el algoritmo dos veces con los mismos participantes y exclusiones
- **THEN** es estadísticamente improbable que el resultado sea idéntico en ambas ejecuciones

### Requirement: Generación de token de participante
Al finalizar una asignación válida, el sistema MUST asociar a cada participante un token único e impredecible (UUID v4). Este token MUST ser distinto del `token_admin` del sorteo. El token MUST persistirse en base de datos junto a la asignación.

#### Scenario: Token único por participante
- **WHEN** el sorteo se lanza exitosamente con N participantes
- **THEN** el sistema genera N tokens distintos entre sí y distintos del `token_admin`, uno por participante

#### Scenario: Token persistido
- **WHEN** el sorteo ha sido lanzado y la base de datos es consultada
- **THEN** cada participante tiene un token no nulo asociado en la tabla de participantes

### Requirement: Persistencia de asignaciones
Las asignaciones resultantes MUST persistirse en base de datos antes de enviar ningún email, de modo que si el envío de email falla para algún participante, el organizador pueda reenviar el enlace sin relanzar el sorteo.

#### Scenario: Persistencia antes del envío
- **WHEN** el algoritmo produce una asignación válida
- **THEN** todas las asignaciones se escriben en base de datos antes de que se intente enviar el primer email
