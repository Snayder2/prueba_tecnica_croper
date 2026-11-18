# Uso de Inteligencia Artificial

> Las partes marcadas con **[COMPLETAR]** dependen de lo que pasó cuando implementaste el código.
> Llénalas con lo que realmente hiciste: en la entrevista te pueden preguntar por cualquiera de estos puntos.

## 1. Herramientas utilizadas

| Herramienta | Para qué se usó |
|---|---|
| Claude (Anthropic), modelo Claude Opus 5.5, en claude.ai | Preparar el entorno (MongoDB en Windows), definir el enfoque de trabajo y redactar la spec del backend. |
| **[COMPLETAR]** (por ejemplo GitHub Copilot, Cursor, Claude Code o la misma conversación) | Implementar las tareas de la spec en código. |

## 2. Enfoque: desarrollo guiado por specs

En lugar de pedirle a la IA "hazme una API de productos" en un solo prompt, se trabajó en dos fases:

1. **Definir antes de generar.** Primero se redactó con la IA una especificación (`docs/specs/01-backend.md`) con el modelo de datos, endpoints, formato de errores, reglas de seguridad, criterios de aceptación y una lista de tareas. Esa spec se revisó y ajustó manualmente antes de escribir código.
2. **Implementar por tareas.** Cada tarea de la spec se pidió por separado y se validó contra los criterios de aceptación antes de pasar a la siguiente.

Motivos:
- Las decisiones de diseño quedan escritas y justificadas, no improvisadas por la IA en cada prompt.
- Cada resultado se puede verificar contra criterios concretos.
- Prompts más cortos y acotados producen código más fácil de revisar.

## 3. Prompts más relevantes

### 3.1 Preparación del entorno

> "Debo hacer este ejercicio pero no tengo Mongo instalado, ¿cómo lo instalo y qué puedo usar para conectarme?" (con el enunciado del Ejercicio 1)

Resultado: tres opciones (Atlas, Docker, instalación nativa). Docker no estaba instalado en Windows, así que se eligió **MongoDB Community Server** local, con Compass como cliente.

> "¿No debería tener una cuenta al menos, como sería el `sa` en SQL Server?"

Resultado: aclaró que la cuenta que pedía el instalador es la cuenta de Windows con la que corre el servicio, no un usuario de la base de datos, y que MongoDB local arranca sin autenticación. Se decidió usar **Network Service** y dejar la autenticación de MongoDB como mejora para producción (ver ejercicio 5).

### 3.2 Elección del enfoque

> "¿Es buena idea hacer esta prueba técnica con specs o solo con prompts normales en .md?"

Resultado: se eligió un enfoque de specs ligeras (un archivo por ejercicio) en lugar de un framework completo de specs, para no agregar ceremonia innecesaria a una prueba de este tamaño.

### 3.3 Redacción de la spec del backend

> "Ayúdame a ir haciendo el .md del backend, mejor uno por uno."

Resultado: primera versión de `docs/specs/01-backend.md`.

> "El backend debe tener un Swagger con la documentación de las APIs, ten eso en cuenta también."

Resultado: se amplió la sección de Swagger con tags, DTOs de respuesta, documentación de errores, persistencia del token y exportación de `docs/openapi.json`, y se agregaron criterios de aceptación específicos.

### 3.4 Implementación

Plantilla usada para cada tarea:

> "Implementa la tarea N de `docs/specs/01-backend.md`. Respeta la estructura de carpetas de la sección 10 y las reglas de las secciones 6 y 7. No implementes nada fuera de esa tarea."

**[COMPLETAR]** Copia aquí 2 o 3 prompts reales que hayan sido importantes, por ejemplo el del módulo de auth o el de paginación, sobre todo si tuviste que repetirlos o corregirlos.

## 4. Cómo se validó el resultado

**[COMPLETAR]** Deja solo lo que realmente hiciste y agrega detalles.

- Revisión línea por línea del código generado antes de aceptarlo.
- Ejecución de los criterios de aceptación de la sección 11 de la spec desde Swagger: registro, login, Authorize y CRUD completo.
- Pruebas de casos negativos: precio negativo, campos extra en el body, `id` inválido, `sku` duplicado, endpoints sin token y más de 5 intentos de login.
- Verificación en MongoDB Compass de que la contraseña se guarda como hash y no aparece en ninguna respuesta.
- `npm test` y `npm run lint` sin errores.

## 5. Ajustes y correcciones

### 5.1 Decisiones propias sobre la propuesta de la IA
- **Instalación de MongoDB:** la IA sugirió Docker primero. Se descartó porque no estaba instalado en Windows y se optó por la instalación nativa.
- **Swagger:** la primera versión de la spec lo cubría de forma básica. Se pidió ampliarlo porque es un requisito explícito y la forma principal en que el evaluador probará la API.
- **[COMPLETAR]** Decisiones de la sección 13 de la spec: eliminación física o lógica, campos del producto (por ejemplo `unit`), registro abierto.

### 5.2 Errores o problemas del código generado
**[COMPLETAR]** Anota los casos reales. Algunos ejemplos típicos para revisar:
- Imports o APIs de librerías que no existían o estaban desactualizados.
- Validaciones de `class-validator` que no coincidían con lo que mostraba Swagger.
- Error de clave duplicada de MongoDB que devolvía 500 en lugar de 409.
- `password` apareciendo en alguna respuesta.
- Paginación que contaba mal el total al aplicar `search`.

Formato sugerido para cada uno: *qué generó la IA → cómo se detectó → cómo se corrigió*.

## 6. Qué no se delegó a la IA

- La elección de las decisiones de diseño de la sección 13 de la spec.
- La revisión de seguridad: que no haya secretos en el código, que `.env` esté en `.gitignore` y que los errores 500 no expongan detalles.
- La verificación final contra los criterios de aceptación.

## 7. Conclusión

La IA aceleró la configuración, la redacción de la spec y el código repetitivo (DTOs, decoradores de Swagger, estructura de módulos). El valor estuvo en definir primero qué se quería y en verificar cada resultado contra criterios concretos, en lugar de aceptar el código tal como salía.
