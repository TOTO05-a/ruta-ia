-- Official INTECAP 2027 offering: 2027.COB.0017.00/DT .I.00254.
-- Active offer/details: https://cursos.intecap.edu.gt/detalle/4377/2027
-- Curriculum: https://www.intecap.edu.gt/centrotics/OfertaTICS-2025-final-comprimido.pdf
-- The curriculum identifies Excel at advanced level and lists 60 + 40 learning hours (100 total).
-- 2027 offer requires basic Excel and describes analysis with Excel and Power BI.
-- This is a modular virtual offer; no CTO/CTM/CTMS career type is stated, so NULL is intentional.
INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT
    'Análisis de datos con Excel y Power BI (E-learning)',
    'Formación para organizar y analizar datos con Excel y Power BI, crear informes estadísticos y visualizaciones, y apoyar la toma de decisiones basada en información.',
    'Análisis de datos',
    'Avanzado',
    NULL,
    100
WHERE NOT EXISTS (
    SELECT 1
    FROM courses
    WHERE lower(name) = lower('Análisis de datos con Excel y Power BI (E-learning)')
);
