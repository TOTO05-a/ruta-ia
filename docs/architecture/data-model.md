# Modelo entidad-relación

El esquema relacional está implementado en `database/migrations/001_initial_schema.sql`; `002_finite_similarity_score.sql` refuerza la validación de scores persistidos y `003_intecap_career_type.sql` añade la clasificación oficial separada de dificultad. PostgreSQL es la fuente de verdad. Qdrant almacena índices vectoriales vinculados por `course_id` y nunca sustituye la comprobación relacional.

```mermaid
erDiagram
    STUDENTS ||--o{ QUERIES : submits
    QUERIES ||--o| RECOMMENDATIONS : produces
    RECOMMENDATIONS ||--|{ RECOMMENDATION_SOURCES : cites
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
    }
    COURSES {
        uuid id PK
        text name
        text description
        text category
        text level
        text intecap_career_type
        numeric duration_hours
        boolean is_active
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
    }
```

## Integridad y límites

- El correo tiene índice único insensible a mayúsculas/minúsculas.
- Los niveles, estados, duración, campos requeridos, estrellas y posiciones tienen restricciones en PostgreSQL.
- `courses.level` representa dificultad didáctica de RutaIA (`Básico`/`Intermedio`/`Avanzado`). `courses.intecap_career_type` conserva por separado los tipos oficiales CTO/CTM/CTMS; no se convierten entre sí. En formaciones modulares sin tipo de carrera, el campo oficial queda `NULL`.
- Una consulta puede producir como máximo una recomendación; cada recomendación conserva de una a cinco fuentes mediante posiciones únicas. La capa de servicio debe exigir al menos una fuente antes de marcarla como `Respondida`.
- La puntuación se almacena sin asumir una escala universal. La integración debe validar que sea finita y documentar la métrica Qdrant seleccionada.
- La calificación es única por recomendación, de acuerdo con la decisión aprobada.
- La capa de servicio debe comprobar que la calificación y sus consultas pertenezcan al estudiante autenticado.
- El catálogo contiene 20 cursos INTECAP respaldados por fichas oficiales y cargados con cuatro seeds idempotentes (`database/seeds/001`–`004`); PostgreSQL y las pruebas de búsqueda/detalle API verificaron el mínimo académico. No se inventan registros ni atributos sin respaldo de fuente.
