ALTER TABLE courses
    ADD COLUMN intecap_career_type TEXT;

ALTER TABLE courses
    ADD CONSTRAINT courses_intecap_career_type_check
    CHECK (intecap_career_type IS NULL OR intecap_career_type IN ('CTO', 'CTM', 'CTMS'));

COMMENT ON COLUMN courses.intecap_career_type IS
    'Official INTECAP career classification; distinct from RutaIA course difficulty level.';
