# Spec Delta

## Purpose

Permite al organizador crear un sorteo de Amigo Invisible, gestionar la lista de participantes, definir exclusiones entre pares de participantes y lanzar el sorteo cuando la configuración esté completa.

## ADDED Requirements

### Requirement: Crear sorteo
El sistema SHALL permitir crear un nuevo sorteo proporcionando: nombre del sorteo, email del organizador y la clave de administrador (`ADMIN_SECRET`). La clave MUST coincidir con la variable de entorno configurada en el servidor; si no coincide o está ausente, el sistema MUST rechazar la operación con 403. Al crearse, el sistema MUST generar dos tokens distintos: un `token_admin` para el acceso exclusivo del organizador y un identificador de sorteo único. El estado inicial del sorteo MUST ser `pendiente`.

#### Scenario: Crear sorteo con datos válidos
- **WHEN** el organizador envía nombre de sorteo no vacío, email válido y la clave de administrador correcta
- **THEN** el sistema crea el sorteo con estado `pendiente` y envía al email del organizador la URL de administración con el `token_admin`

#### Scenario: Crear sorteo con clave de administrador incorrecta
- **WHEN** el organizador intenta crear un sorteo con una clave de administrador incorrecta o ausente
- **THEN** el sistema devuelve 403 sin crear el sorteo

#### Scenario: Crear sorteo con nombre vacío
- **WHEN** el organizador intenta crear un sorteo sin nombre
- **THEN** el sistema rechaza la operación con un mensaje de error indicando que el nombre es obligatorio

### Requirement: Añadir participante
El sistema SHALL permitir al organizador añadir participantes al sorteo mientras su estado sea `pendiente`. Cada participante MUST tener un nombre y un email válido. El email MUST ser único dentro del mismo sorteo.

#### Scenario: Añadir participante con datos válidos
- **WHEN** el organizador envía nombre y email válidos para un participante nuevo
- **THEN** el sistema añade al participante, le asigna un token único y lo muestra en la lista del panel de administración

#### Scenario: Añadir participante con email duplicado
- **WHEN** el organizador intenta añadir un participante con un email ya registrado en ese sorteo
- **THEN** el sistema rechaza la operación con un mensaje de error indicando que ese email ya está en la lista

#### Scenario: Añadir participante a sorteo ya lanzado
- **WHEN** el organizador intenta añadir un participante a un sorteo con estado `lanzado`
- **THEN** el sistema rechaza la operación con un mensaje de error indicando que el sorteo ya fue lanzado

### Requirement: Eliminar participante
El sistema SHALL permitir al organizador eliminar un participante del sorteo mientras su estado sea `pendiente`. Al eliminarlo, MUST eliminarse también cualquier exclusión en la que ese participante esté involucrado.

#### Scenario: Eliminar participante en sorteo pendiente
- **WHEN** el organizador solicita eliminar un participante de un sorteo `pendiente`
- **THEN** el sistema elimina al participante y todas sus exclusiones asociadas, y actualiza la lista visible

### Requirement: Definir exclusión
El sistema SHALL permitir al organizador declarar que dos participantes no pueden asignarse mutuamente como Amigo Invisible. Las exclusiones SON bidireccionales: si A excluye a B, B tampoco puede tocar a A. No se puede excluir a un participante consigo mismo.

#### Scenario: Definir exclusión válida
- **WHEN** el organizador selecciona dos participantes distintos y declara la exclusión
- **THEN** el sistema registra la exclusión bidireccional y la muestra en el panel

#### Scenario: Excluir participante consigo mismo
- **WHEN** el organizador intenta excluir a un participante con sí mismo
- **THEN** el sistema rechaza la operación con un mensaje de error

#### Scenario: Exclusión duplicada
- **WHEN** el organizador intenta registrar una exclusión entre dos participantes que ya tienen una exclusión registrada
- **THEN** el sistema ignora la operación sin error visible (idempotente)

### Requirement: Eliminar exclusión
El sistema SHALL permitir al organizador eliminar una exclusión existente mientras el sorteo esté en estado `pendiente`.

#### Scenario: Eliminar exclusión existente
- **WHEN** el organizador solicita eliminar una exclusión
- **THEN** el sistema la elimina y actualiza la lista de exclusiones visible en el panel

### Requirement: Lanzar sorteo
El sistema SHALL permitir al organizador lanzar el sorteo cuando haya al menos 3 participantes y el sorteo esté en estado `pendiente`. Al lanzarlo, el sistema MUST ejecutar el algoritmo de asignación, cambiar el estado a `lanzado` y enviar el email a cada participante. Esta operación es irreversible.

#### Scenario: Lanzar sorteo con suficientes participantes
- **WHEN** el organizador lanza un sorteo con 3 o más participantes y estado `pendiente`
- **THEN** el sistema ejecuta la asignación, marca el sorteo como `lanzado` y envía los emails

#### Scenario: Lanzar sorteo con menos de 3 participantes
- **WHEN** el organizador intenta lanzar un sorteo con menos de 3 participantes
- **THEN** el sistema rechaza la operación con un mensaje indicando el mínimo requerido

#### Scenario: Lanzar sorteo ya lanzado
- **WHEN** el organizador intenta lanzar un sorteo que ya tiene estado `lanzado`
- **THEN** el sistema rechaza la operación con un mensaje indicando que el sorteo ya fue lanzado

### Requirement: Acceso exclusivo al panel de administración
El panel de administración MUST ser accesible únicamente mediante la URL que contiene el `token_admin`. Una petición sin `token_admin` válido MUST recibir una respuesta de error 403. El `token_admin` MUST ser un UUID v4 generado aleatoriamente, impredecible.

#### Scenario: Acceso con token_admin válido
- **WHEN** el organizador accede al panel con un `token_admin` correcto
- **THEN** el sistema muestra el panel de administración del sorteo correspondiente

#### Scenario: Acceso sin token o con token inválido
- **WHEN** alguien accede a la URL del panel sin `token_admin` o con uno incorrecto
- **THEN** el sistema devuelve un error 403 sin revelar información del sorteo

### Requirement: Mensaje personalizado del organizador
El sistema SHALL permitir al organizador añadir un mensaje personalizado opcional al sorteo en cualquier momento mientras el estado sea `pendiente`. Este mensaje MUST mostrarse a cada participante en su página de resultado. El mensaje es de texto libre, sin formato, con un máximo de 500 caracteres. Si no se establece, la página de resultado no muestra ningún mensaje adicional.

#### Scenario: Añadir mensaje personalizado
- **WHEN** el organizador envía un mensaje no vacío de hasta 500 caracteres
- **THEN** el sistema almacena el mensaje y lo confirma en el panel

#### Scenario: Mensaje vacío elimina el mensaje existente
- **WHEN** el organizador envía un mensaje vacío o en blanco
- **THEN** el sistema elimina el mensaje existente del sorteo

#### Scenario: Mensaje demasiado largo
- **WHEN** el organizador envía un mensaje de más de 500 caracteres
- **THEN** el sistema rechaza la operación con un mensaje de error indicando el límite
