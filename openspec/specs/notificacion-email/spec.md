# notificacion-email Specification

## Purpose

Define el comportamiento observable del envío de emails a los participantes: qué contiene cada email, cuándo se envía, qué ocurre si el envío falla y cómo puede el organizador reenviar un enlace a un participante concreto.

## Requirements

### Requirement: Envío automático al lanzar el sorteo
Cuando el sorteo pasa a estado `lanzado`, el sistema MUST intentar enviar un email a cada participante con el enlace personal que contiene su token único. El envío MUST realizarse después de que todas las asignaciones hayan sido persistidas en base de datos.

#### Scenario: Envío exitoso a todos los participantes
- **WHEN** el sorteo se lanza con N participantes y todos los emails son válidos
- **THEN** el sistema envía N emails, uno a cada participante, cada uno con el enlace único de ese participante

#### Scenario: Fallo de envío en uno o más participantes
- **WHEN** el envío de email falla para uno o más participantes durante el lanzamiento
- **THEN** el sistema marca el sorteo como `lanzado` igualmente (las asignaciones ya están persistidas), registra qué participantes no recibieron el email y el organizador puede reenviar el enlace desde el panel

### Requirement: Contenido del email
Cada email enviado a un participante MUST contener:
1. El nombre del participante como saludo personalizado.
2. El nombre del sorteo.
3. Un enlace (URL completa) que lleva directamente a la página de resultado del participante, construida con su token único.
4. Una instrucción para guardar el email como método de acceso permanente.

El email NO MUST revelar el nombre del receptor en el cuerpo del mensaje — ese dato solo se muestra al abrir el enlace en la aplicación.

#### Scenario: Email recibido por el participante
- **WHEN** el participante recibe el email de su Amigo Invisible
- **THEN** el email contiene su nombre, el nombre del sorteo y el enlace personal, pero NO el nombre de la persona a quien le toca regalar

#### Scenario: Enlace del email lleva al resultado correcto
- **WHEN** el participante hace clic en el enlace del email
- **THEN** el navegador abre la página de resultado mostrando el nombre de su receptor asignado

### Requirement: Reenvío de enlace por el organizador
El sistema SHALL permitir al organizador reenviar el email con el enlace personal a un participante concreto desde el panel de administración, en cualquier momento después de que el sorteo esté en estado `lanzado`.

#### Scenario: Reenvío exitoso
- **WHEN** el organizador solicita reenviar el email a un participante de un sorteo `lanzado`
- **THEN** el sistema envía de nuevo el email con el mismo enlace (el token no cambia) y muestra confirmación al organizador

#### Scenario: Reenvío en sorteo no lanzado
- **WHEN** el organizador intenta reenviar el email a un participante de un sorteo `pendiente`
- **THEN** el sistema rechaza la operación indicando que el sorteo aún no ha sido lanzado

### Requirement: El organizador no recibe email de resultados
El sistema MUST NOT enviar ningún email al organizador que revele las asignaciones del sorteo, ni de forma directa ni indirecta (por ejemplo, un resumen «todos asignados»). El organizador puede recibir únicamente confirmación de que el sorteo fue lanzado correctamente.

#### Scenario: Sin email de resultados al organizador
- **WHEN** el sorteo se lanza exitosamente
- **THEN** no se envía ningún email al organizador que contenga información sobre las asignaciones

### Requirement: Email de confirmación al organizador al crear el sorteo
Cuando se crea un sorteo exitosamente, el sistema MUST enviar un email al email del organizador con la URL de administración que contiene el `token_admin`. Este email es el único mecanismo de recuperación del acceso de administración si el organizador cierra el navegador. El email MUST contener el nombre del sorteo y la URL completa del panel de administración.

#### Scenario: Email de acceso admin enviado al crear sorteo
- **WHEN** el organizador crea un sorteo con nombre, email y clave de administrador válidos
- **THEN** el sistema envía al email del organizador un mensaje con el nombre del sorteo y la URL completa del panel de administración

#### Scenario: El email de acceso admin no revela asignaciones
- **WHEN** el email de acceso admin es enviado al organizador
- **THEN** el email contiene únicamente la URL de administración y el nombre del sorteo, sin ninguna asignación ni resultado del sorteo
