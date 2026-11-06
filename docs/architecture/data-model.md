# Modelo entidad-relación

El esquema relacional está implementado en `database/migrations/001_initial_schema.sql` y ampliado por las migraciones `002`–`005`. PostgreSQL es la fuente de verdad. Qdrant almacena índices vectoriales vinculados por `course_id` y nunca sustituye la comprobación relacional.

```mermaid
erDiagram
    STUDENTS ||--o{ SESSIONS : opens
    STUDENTS ||--o{ QUERIES : submits
    QUERIES ||--o| RECOMMENDATIONS : produces
    RECOMMENDATIONS ||--o{ RECOMMENDATION_SOURCES : cites
    COURSES ||--o{ RECOMMENDATION_SOURCES : grounds
    STUDENTS ||--o{ RATINGS : gives
    RECOMMENDATIONS ||--o| RATINGS : receives

    STUDENTS {
        uuid id PK
        text full_name
        text email UK
        text password_hash
        text experience_level
        text interest_area
        text role
        timestamptz created_at
        timestamptz updated_at
    }
    SESSIONS {
        uuid id PK
        uuid student_id FK
        char token_hash UK
        text csrf_token
        timestamptz expires_at
        timestamptz created_at
    }
    COURSES {
        uuid id PK
        text name
        text description
        text category
        text level
        text intecap_career_type
        numeric(8,2) duration_hours
        text source_url
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    QUERIES {
        uuid id PK
        uuid student_id FK
        text question
        text status
        text error_code
        timestamptz created_at
        timestamptz completed_at
    }
    RECOMMENDATIONS {
        uuid id PK
        uuid query_id FK_UK
        text answer
        text summary
        text explanation
        timestamptz created_at
    }
    RECOMMENDATION_SOURCES {
        uuid recommendation_id PK, FK
        uuid course_id PK, FK
        numeric similarity_score
        smallint position
    }
    RATINGS {
        uuid id PK
        uuid recommendation_id FK_UK
        uuid student_id FK
        smallint score
        text comment
        timestamptz created_at
    }
    COURSE_QDRANT_SYNC_OUTBOX {
        bigint id PK
        uuid course_id
        text action
        bigint version
        jsonb payload
        integer attempts
        timestamptz available_at
        timestamptz locked_until
        timestamptz created_at
    }
```

## Integridad y límites

- El correo tiene índice único insensible a mayúsculas/minúsculas.
- Los niveles, estados, duración, campos requeridos, estrellas y posiciones tienen restricciones en PostgreSQL.
- `courses.level` representa dificultad didáctica de RutaIA (`Básico`/`Intermedio`/`Avanzado`). `courses.intecap_career_type` conserva por separado los tipos oficiales CTO/CTM/CTMS; no se convierten entre sí. En formaciones modulares sin tipo de carrera, el campo oficial queda `NULL`.
- `courses.source_url`, cuando existe, debe usar HTTPS. Una consulta puede producir como máximo una recomendación; cada recomendación conserva de una a cinco fuentes mediante posiciones únicas. La capa de servicio debe exigir al menos una fuente antes de marcarla como `Respondida`; la base no impone ese mínimo.
- La puntuación se almacena sin asumir una escala universal. La integración debe validar que sea finita y documentar la métrica Qdrant seleccionada.
- La calificación es única por recomendación, de acuerdo con la decisión aprobada.
- La capa de servicio debe comprobar que la calificación y sus consultas pertenezcan al estudiante autenticado.
- `course_qdrant_sync_outbox` conserva cambios durables para sincronizar el catálogo y el índice vectorial. `course_id` no tiene clave foránea intencionalmente: el evento debe poder sobrevivir a la eliminación del curso en PostgreSQL.
- Cada embedding representa un curso como un vector de 1536 números. Qdrant compara esos vectores para localizar cursos semánticamente cercanos; las 1536 dimensiones no representan cursos ni calificaciones.
- Los seeds idempotentes `database/seeds/001`–`011` mantienen 37 cursos INTECAP con fuente HTTPS. Ocho cursos de los seeds 009–011 calculan `duration_hours` desde las fechas, días y horarios oficiales; sus descripciones aclaran que son horas programadas, no carga curricular oficial. La base local tiene un curso activo adicional administrado desde la app sin `source_url`, para un total de 38; no se cuenta como curso institucional verificado. El nivel didáctico `level` de RutaIA se distingue de CTO/CTM/CTMS. Estado local verificado el 6 de noviembre de 2026: los 37 cursos INTECAP activos están indexados en `rutaia_courses_gemini_1536` (1536 dimensiones); la colección histórica `rutaia_courses` conserva 38 puntos de 1024 dimensiones.
