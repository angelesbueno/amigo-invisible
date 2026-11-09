# vista-participante Specification

## Purpose

Define el comportamiento observable de la página que el participante ve al abrir su enlace personal: qué información se muestra, qué ocurre con tokens inválidos o expirados y los requisitos de presentación visual adaptada a dispositivos móviles.

## Requirements

### Requirement: Mostrar asignación por token
Cuando un participante accede a la URL de resultado con su token válido, el sistema MUST mostrar exclusivamente el nombre de la persona a quien le ha tocado regalar. El sistema MUST NOT mostrar la lista completa de asignaciones ni ninguna otra asignación del sorteo.

#### Scenario: Acceso con token válido
- **WHEN** el participante abre la URL con su token correcto
- **THEN** el sistema muestra una página con su nombre y el nombre de su receptor asignado, sin ninguna otra asignación visible

#### Scenario: Token válido pero sorteo pendiente
- **WHEN** el participante accede con un token válido pero el sorteo todavía está en estado `pendiente`
- **THEN** el sistema muestra un mensaje indicando que el sorteo aún no ha sido lanzado, sin revelar ninguna asignación

### Requirement: Rechazo de token inválido
Cualquier acceso a la URL de resultado con un token que no existe en base de datos MUST recibir una respuesta de error 404 que no revele información sobre el sorteo ni sobre otros participantes.

#### Scenario: Token inexistente
- **WHEN** alguien accede a la URL de resultado con un token que no existe en la base de datos
- **THEN** el sistema devuelve un error 404 con un mensaje genérico, sin revelar información del sorteo

#### Scenario: URL de resultado sin token
- **WHEN** alguien accede a la URL de resultado sin incluir el parámetro de token
- **THEN** el sistema devuelve un error 404 con un mensaje genérico

### Requirement: Diseño adaptado a móvil y tablet
La página de resultado MUST ser completamente funcional y legible en pantallas de ancho mínimo 320px (móvil) y hasta 1280px (escritorio). El diseño MUST seguir una estrategia mobile-first. Los textos y el nombre del receptor MUST ser legibles sin necesidad de hacer zoom.

#### Scenario: Visualización en móvil
- **WHEN** el participante abre su enlace desde el navegador de un teléfono móvil
- **THEN** la página se muestra correctamente adaptada a la pantalla, sin scroll horizontal y con el nombre del receptor visible sin hacer zoom

#### Scenario: Visualización en tablet
- **WHEN** el participante abre su enlace desde una tablet
- **THEN** la página se muestra correctamente adaptada, aprovechando el espacio adicional de pantalla

### Requirement: Diseño festivo y moderno
La página de resultado MUST presentar una estética festiva y visualmente moderna, acorde al contexto navideño de la aplicación, usando una paleta de colores y tipografía coherentes con el año 2026. El diseño MUST transmitir celebración y sorpresa al revelar el resultado.

#### Scenario: Primera visita a la página de resultado
- **WHEN** el participante abre su enlace por primera vez
- **THEN** la página presenta el resultado con elementos visuales festivos (animaciones, iconografía navideña, paleta de colores celebratoria) que refuercen el momento del descubrimiento

### Requirement: Acceso repetido al resultado
El enlace personal de un participante MUST ser válido de forma indefinida mientras el sorteo exista en base de datos. No existe expiración automática del token. El participante MUST poder consultar su asignación tantas veces como quiera.

#### Scenario: Segunda visita con el mismo enlace
- **WHEN** el participante abre su enlace personal por segunda o enésima vez
- **THEN** el sistema muestra el mismo resultado que en la primera visita, sin ningún cambio

### Requirement: Mostrar mensaje personalizado del organizador
Si el sorteo tiene un mensaje personalizado configurado, la página de resultado MUST mostrarlo junto a la asignación. Si no hay mensaje, la página MUST NOT mostrar ningún espacio vacío ni texto de sustitución por ese campo.

#### Scenario: Resultado con mensaje personalizado
- **WHEN** el participante accede a su página de resultado y el sorteo tiene un mensaje configurado
- **THEN** la página muestra el nombre del receptor y el mensaje del organizador

#### Scenario: Resultado sin mensaje personalizado
- **WHEN** el participante accede a su página de resultado y el sorteo no tiene mensaje configurado
- **THEN** la página muestra únicamente el nombre del receptor, sin espacio vacío ni texto de sustitución
