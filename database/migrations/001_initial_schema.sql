-- RutaIA relational schema. PostgreSQL 13+ (gen_random_uuid is built in).
-- Apply once to an empty RutaIA database; migrations are versioned, not rerunnable.

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    experience_level TEXT NOT NULL
        CHECK (experience_level IN ('Principiante', 'Intermedio', 'Avanzado')),
    interest_area TEXT NOT NULL CHECK (length(trim(interest_area)) > 0),
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX students_email_lower_unique ON students (lower(email));

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    category TEXT NOT NULL CHECK (length(trim(category)) > 0),
    level TEXT NOT NULL CHECK (level IN ('Básico', 'Intermedio', 'Avanzado')),
    duration_hours NUMERIC(8, 2) NOT NULL CHECK (duration_hours > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX courses_active_idx ON courses (is_active);
CREATE INDEX courses_category_idx ON courses (category);
CREATE INDEX courses_level_idx ON courses (level);

CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    question TEXT NOT NULL CHECK (length(trim(question)) > 0),
    status TEXT NOT NULL DEFAULT 'Pendiente'
        CHECK (status IN ('Pendiente', 'Respondida', 'Sin resultados', 'Error')),
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX queries_student_created_idx ON queries (student_id, created_at DESC);
CREATE INDEX queries_status_created_idx ON queries (status, created_at DESC);

CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL UNIQUE REFERENCES queries(id) ON DELETE RESTRICT,
    answer TEXT NOT NULL CHECK (length(trim(answer)) > 0),
    summary TEXT NOT NULL CHECK (length(trim(summary)) > 0),
    explanation TEXT NOT NULL CHECK (length(trim(explanation)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recommendation_sources (
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    similarity_score NUMERIC NOT NULL,
    position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5),
    PRIMARY KEY (recommendation_id, course_id),
    UNIQUE (recommendation_id, position),
    CHECK (similarity_score <> 'NaN'::numeric)
);

CREATE INDEX recommendation_sources_course_idx ON recommendation_sources (course_id);

CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL UNIQUE REFERENCES recommendations(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ratings_student_idx ON ratings (student_id);

COMMENT ON TABLE courses IS 'Relational source of truth; public catalog and recommendations include active courses only.';
COMMENT ON TABLE recommendation_sources IS 'Persisted Qdrant matches; score scale follows the configured Qdrant metric/model.';
COMMENT ON TABLE ratings IS 'One rating per recommendation, matching the approved product decision.';
