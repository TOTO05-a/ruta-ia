-- Official INTECAP offers with published schedules, but no curriculum-hour total.
-- duration_hours stores scheduled hours calculated from the published dates and timetable.

INSERT INTO courses (name, description, category, level, duration_hours, source_url)
SELECT 'Lenguaje de programación Java (E-learning)',
       'Curso en línea de lenguaje de programación Java. INTECAP publica diez sesiones de lunes a viernes, de 18:00 a 22:00, del 16/11/2026 al 27/11/2026: 40 horas programadas calculadas desde el horario; la ficha no declara una duración curricular total.',
       'Programación', 'Básico', 40,
       'https://cursos.intecap.edu.gt/detalle/45278/2026'
WHERE NOT EXISTS (
    SELECT 1 FROM courses
    WHERE lower(name) = lower('Lenguaje de programación Java (E-learning)')
);

INSERT INTO courses (name, description, category, level, duration_hours, source_url)
SELECT 'Power BI básico',
       'Curso básico para usar Power BI Desktop, analizar información de empresas y convertirla en información útil para apoyar la toma de decisiones. INTECAP publica diez sesiones de martes y jueves, de 16:00 a 18:00, del 10/11/2026 al 10/12/2026: 20 horas programadas calculadas desde el horario; la ficha no declara una duración curricular total.',
       'Análisis de datos', 'Básico', 20,
       'https://cursos.intecap.edu.gt/detalle/43108/2026'
WHERE NOT EXISTS (
    SELECT 1 FROM courses
    WHERE lower(name) = lower('Power BI básico')
);
