# Spec Delta

## Purpose

Garantiza que el organizador del sorteo no puede acceder, ni directa ni indirectamente, a las asignaciones realizadas, preservando la integridad del juego y la confianza de todos los participantes.

## ADDED Requirements

### Requirement: Panel de administración sin acceso a asignaciones
El panel de administración accesible con el `token_admin` MUST NOT mostrar en ningún momento el nombre del receptor asignado a ningún participante. El panel MUST mostrar únicamente: nombre del sorteo, estado del sorteo, lista de participantes (nombre y email) y lista de exclusiones.

#### Scenario: Organizador consulta el panel tras lanzar el sorteo
- **WHEN** el organizador accede al panel de administración con su `token_admin` después de que el sorteo haya sido lanzado
- **THEN** el panel muestra el estado `lanzado` y la lista de participantes, pero no revela a quién le ha tocado a ninguno de ellos

#### Scenario: Organizador intenta acceder a la API de resultados
- **WHEN** se realiza una petición a cualquier endpoint de la API con el `token_admin`
- **THEN** el sistema MUST NOT devolver datos de asignaciones; cualquier endpoint que devuelva asignaciones MUST requerir el token de participante, no el `token_admin`

### Requirement: Separación de tokens de administración y participación
El sistema MUST usar tokens distintos para el acceso de administración (`token_admin`) y para el acceso de participante (token de participante). El `token_admin` MUST NOT ser válido para acceder a ninguna vista o endpoint de participante. Un token de participante MUST NOT otorgar acceso al panel de administración.

#### Scenario: Uso de token_admin en endpoint de participante
- **WHEN** alguien usa el `token_admin` como si fuera un token de participante en la URL de resultado
- **THEN** el sistema devuelve un error 404, igual que con cualquier token de participante inexistente

#### Scenario: Uso de token de participante en panel de administración
- **WHEN** alguien usa un token de participante en la URL del panel de administración
- **THEN** el sistema devuelve un error 403 sin mostrar información del sorteo

### Requirement: Sin endpoint de exportación total de asignaciones
El sistema MUST NOT exponer ningún endpoint, vista, ni funcionalidad que devuelva la lista completa de asignaciones del sorteo (todos los pares regalador→receptor a la vez), independientemente del token empleado en la petición.

#### Scenario: Intento de obtener todas las asignaciones
- **WHEN** se realiza una petición a cualquier ruta del sistema intentando obtener la lista completa de asignaciones
- **THEN** el sistema no dispone de tal endpoint; la petición recibe un error 404

### Requirement: Registro de accesos no revelador
Si el sistema registra logs de acceso, dichos logs MUST NOT almacenar el nombre del receptor en texto plano asociado al token de un participante, de modo que un acceso no autorizado a los logs no revele el resultado del sorteo.

#### Scenario: Log de acceso a vista de participante
- **WHEN** un participante accede a su página de resultado
- **THEN** el log de la petición registra como máximo el token (o su hash) y la marca de tiempo, pero no el nombre del receptor asignado
