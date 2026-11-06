---
title: Guía sencilla para explicar y demostrar RutaIA
updated: 6 de noviembre de 2026
---

# RutaIA: guía para leer, explicar y demostrar el proyecto

Esta guía está escrita para estudiar la arquitectura y explicar el proyecto con palabras sencillas. No hace falta memorizar todos los nombres técnicos: entiende el recorrido y usa las frases sugeridas como apoyo.

## 1. La idea del proyecto en 30 segundos

> RutaIA ayuda a una persona a encontrar cursos del catálogo institucional relacionados con lo que quiere aprender. La persona pregunta desde la aplicación; Express valida y guarda la consulta, n8n coordina la búsqueda, Qdrant encuentra cursos con significado parecido y Gemini ayuda a redactar una explicación basada en esos cursos. PostgreSQL conserva los datos oficiales y el historial.

La IA no inventa el catálogo. Las recomendaciones deben apuntar a cursos reales, activos y guardados en PostgreSQL.

## 2. Cómo se conecta todo

```text
Estudiante
   ↓ usa
Frontend (HTML, CSS y JavaScript)
   ↓ API REST con JSON
Express / Node.js
   ├── PostgreSQL: cuentas, cursos, consultas, fuentes y calificaciones
   ├── n8n: coordinación de los pasos automáticos
   └── Gemini: embeddings y redacción, mediante proxies privados de Express
                ↑                         ↓
                └──── Qdrant: búsqueda semántica de cursos
```

### Qué hace cada parte

| Parte | Explicación sencilla | Qué no hace |
|---|---|---|
| Frontend | Es la pantalla con la que interactúa el estudiante. Envía solicitudes REST a Express. | No se conecta directamente a las bases de datos ni guarda claves de IA. |
| Express | Es la puerta de entrada del sistema: valida datos, comprueba la sesión y los permisos, aplica reglas y coordina las operaciones. | No delega la autoridad de los datos de cursos a Qdrant. |
| PostgreSQL | Guarda los datos relacionales y es la fuente de verdad: estudiantes, cursos, preguntas, recomendaciones, fuentes, calificaciones y eventos pendientes. | No hace la búsqueda vectorial. |
| n8n | Ejecuta y conecta pasos de automatización mediante workflows. | No sustituye a la API ni es la fuente oficial del catálogo. |
| Qdrant | Busca vectores de cursos parecidos a la pregunta. Devuelve identificadores y puntuaciones de similitud. | No guarda las cuentas ni demuestra por sí solo que un curso siga activo. |
| Gemini | Convierte texto en embeddings y redacta una respuesta estructurada con el contexto recuperado. | No debe recibir secretos desde el navegador ni inventar cursos como fuentes. |

El navegador habla con Express. n8n y Express se comunican mediante webhooks y callbacks autenticados. Las claves para Gemini permanecen en el backend. PostgreSQL valida que las fuentes seleccionadas sean cursos activos antes de guardar una recomendación.

## 3. Qué ocurre cuando alguien hace una pregunta

Sigue la pregunta como si fuera un paquete que atraviesa la aplicación:

1. El estudiante escribe una meta, por ejemplo: “Quiero aprender a crear páginas web”.
2. El frontend envía la pregunta y, si se eligieron, los filtros de categoría o nivel a la API REST de Express.
3. Express valida la entrada, identifica al estudiante autenticado y crea una consulta con estado **Pendiente** en PostgreSQL.
4. Express envía a n8n una solicitud autenticada. Puede incluir hasta tres intercambios recientes de esa misma persona para dar continuidad a la conversación.
5. n8n pide a Express el embedding de la pregunta. Express llama a Gemini con su clave protegida y devuelve el vector.
6. n8n consulta Qdrant. Qdrant compara el vector de la pregunta con los vectores de los cursos y entrega candidatos ordenados por similitud.
7. El flujo contrasta los candidatos con el catálogo activo de PostgreSQL, aplica filtros y el umbral de similitud, y evita recomendar cursos que ya no están activos.
8. Si hay suficientes fuentes válidas, el backend pide a Gemini que redacte una respuesta usando esos cursos como contexto.
9. n8n devuelve mediante un callback autenticado la respuesta y sus fuentes. Express valida el resultado y lo guarda en PostgreSQL.
10. La consulta termina como **Respondida**, **Sin resultados** o **Error**. El frontend muestra la respuesta, los cursos citados y permite calificarla.

**Idea clave para explicar el RAG:** primero se recupera información del catálogo y luego se genera una explicación basada en esa información. “RAG” significa generación aumentada con recuperación; no significa que el modelo se haya entrenado con los cursos.

## 4. Los tres workflows de n8n

### A. Responder consultas RAG

Es el flujo que participa cuando el estudiante hace una pregunta. Recibe la solicitud, obtiene el embedding, consulta Qdrant, filtra los candidatos y devuelve una respuesta con fuentes mediante el callback de Express.

**Estado operativo conocido:** el responder Gemini está publicado y una prueba de extremo a extremo llegó a **Respondida**, guardó tres fuentes y apareció en el historial. La prueba temporal se limpió después.

### B. Indexar cursos activos

Reconcilia el catálogo completo: lee los cursos activos, solicita embeddings, valida que cada vector sea correcto y crea o actualiza sus puntos en Qdrant. También permite quitar del índice cursos que ya no están activos.

Es una operación de reconstrucción, no la búsqueda que ocurre por cada pregunta. El archivo del workflow está versionado e inactivo; no se debe activar sin revisar la configuración y las credenciales de la instancia.

### C. Sincronizar cambios incrementales

PostgreSQL registra cambios importantes del catálogo en una cola llamada *outbox*. El workflow puede procesarlos de uno en uno: crea o actualiza el vector de un curso, o lo elimina si el curso fue desactivado.

La cola permite reintentar un evento si falla una operación externa. El workflow incremental está inactivo. Quedaron dos eventos de eliminación pendientes, así que no debe afirmarse que la sincronización automática esté al día.

**Importante:** los archivos JSON versionados no cambian por sí solos la instancia de n8n. La instancia y los exports en Git son cosas relacionadas, pero distintas.

## 5. Qué significan los embeddings y las 1536 dimensiones

Un embedding es una lista de números que representa rasgos del significado de un texto. Por ejemplo, un curso sobre desarrollo web y una pregunta sobre crear páginas pueden tener vectores cercanos aunque no usen exactamente las mismas palabras.

En RutaIA, cada curso se representa con **1536 números** y Qdrant usa distancia **Cosine** para comparar vectores.

- **1536 dimensiones** = 1536 valores o posiciones en el vector de cada texto.
- **No** significa que haya 1536 cursos.
- **No** significa que la respuesta tenga 1536 palabras.
- **No** significa que se hayan usado 1536 fuentes.

Una analogía: cada vector es como una coordenada con muchas características del significado. Qdrant busca coordenadas cercanas. La dimensión es el tamaño de esa representación, no la cantidad de elementos del catálogo.

La colección nueva es `rutaia_courses_gemini_1536`. La colección anterior `rutaia_courses`, de 1024 dimensiones, se conserva separada; no deben mezclarse ni reutilizarse como si fueran el mismo índice. La calibración usó 37 cursos y 22 consultas. El umbral `0.642` es provisional: una puntuación alta ayuda a filtrar candidatos, pero no demuestra por sí sola que una recomendación sea adecuada.

## 6. Cómo explicar el modelo entidad-relación

PostgreSQL guarda entidades y relaciones. Explica las tablas siguiendo esta cadena:

1. Un **estudiante** puede tener varias **sesiones** y enviar varias **consultas**.
2. Una **consulta** puede producir como máximo una **recomendación**.
3. Una recomendación conserva una o más **fuentes**, que apuntan a cursos del catálogo.
4. Una recomendación puede recibir una **calificación**; se conserva quién la dio.
5. La **cola outbox** registra cambios de cursos que deben propagarse a Qdrant.

Qdrant no aparece como tabla del diagrama ER porque es un servicio externo de búsqueda vectorial. PostgreSQL conserva los cursos y decide si están activos; Qdrant conserva la representación usada para encontrarlos. El campo `course_id` vincula un punto vectorial con el curso relacional.

El diagrama con columnas y restricciones está en [data-model.md](../architecture/data-model.md). El diagrama de componentes está en [system-context.md](../architecture/system-context.md).

## 7. Validaciones, errores y seguridad en palabras simples

- **Zod**, integrado en la API de Express, comprueba que las entradas tengan la forma y los valores permitidos antes de procesarlas.
- La autenticación identifica al usuario; la autorización comprueba qué puede hacer. El historial y la memoria se limitan a la persona autenticada.
- PostgreSQL aplica restricciones adicionales, como correos únicos y puntuaciones válidas.
- Las respuestas de error usan códigos y mensajes controlados; no deberían exponer contraseñas, claves ni respuestas internas del proveedor.
- Los workflows y los callbacks internos requieren credenciales. La clave de Gemini se mantiene en el backend.
- Si no se encuentran al menos tres fuentes válidas sobre el umbral, la consulta no debe presentarse como una recomendación completa.

## 8. Recorrido de demostración

1. Abre RutaIA e inicia sesión con una cuenta autorizada.
2. En **Inicio**, escribe una pregunta concreta y envíala.
3. Explica que la consulta pasa por Express y que la recuperación usa el catálogo; no digas que la IA inventa o posee el catálogo.
4. Muestra la respuesta, sus cursos fuente y la opción de calificar.
5. Abre **Mi historial** y señala que la consulta persistida mantiene su estado y fuentes.
6. Si te preguntan por Qdrant, explica que es el índice semántico. Si te preguntan por n8n, muestra el workflow del responder y distingue los exports inactivos del estado de la instancia.
7. Para el ER, muestra [data-model.md](../architecture/data-model.md). Para las conexiones, muestra [system-context.md](../architecture/system-context.md).

Direcciones locales: aplicación `http://localhost:3001/`, n8n `http://localhost:5678/` y panel Qdrant `http://localhost:6333/dashboard`. PostgreSQL no tiene una pantalla web de la aplicación.

## 9. Guion oral breve

> RutaIA recomienda cursos institucionales relacionados con la meta del estudiante. El frontend se comunica con la API REST de Express. Express valida la solicitud y guarda la consulta en PostgreSQL. n8n coordina el proceso RAG: convierte la pregunta en un embedding mediante el backend, busca cursos parecidos en Qdrant y devuelve fuentes que se verifican contra PostgreSQL. Gemini redacta una explicación con esas fuentes. PostgreSQL sigue siendo la fuente de verdad; Qdrant es el índice de búsqueda semántica. Los embeddings tienen 1536 dimensiones, es decir, 1536 valores por vector, no 1536 cursos.

## 10. Preguntas probables del profesor

**¿Qué es RAG?**

Es una forma de responder recuperando primero información pertinente y dándosela al modelo como contexto para que genere una explicación basada en ella.

**¿Por qué hay PostgreSQL y Qdrant?**

PostgreSQL conserva datos oficiales, relaciones e historial. Qdrant se especializa en encontrar vectores cercanos por significado. Cumplen funciones distintas.

**¿Gemini decide qué cursos existen?**

No. El catálogo está en PostgreSQL. La respuesta se limita a fuentes recuperadas y validadas; la IA redacta la explicación.

**¿Qué representan las 1536 dimensiones?**

La cantidad de valores del vector que representa un texto. No es el número de cursos.

**¿Todo está automatizado actualmente?**

No. El responder RAG está publicado y se probó de extremo a extremo. La indexación completa y la sincronización incremental están inactivas; quedan dos eventos de eliminación en cola.

**¿Qué pasa si Qdrant o Gemini falla?**

La API debe conservar un error controlado en el estado de la consulta. Los cambios incrementales no se deben confirmar si falló la actualización externa, de modo que se puedan reintentar.

## 11. Qué pruebas dicen y qué no dicen

Las pruebas unitarias, de workflows y de OpenAPI verifican contratos y lógica local; muchas usan simulaciones y no contactan servicios externos. La evidencia de integración real es distinta: se completó una consulta de extremo a extremo con Gemini, n8n, Qdrant y PostgreSQL, que quedó respondida con tres fuentes. La matriz de pruebas enumera los alcances en [acceptance-test-matrix.md](../testing/acceptance-test-matrix.md).

Los detalles de configuración y operación de los workflows están en [automation/n8n/README.md](../../automation/n8n/README.md). No compartas archivos `.env`, contraseñas ni claves al presentar el proyecto.