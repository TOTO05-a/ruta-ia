-- Course facts: INTECAP, 2027 offering, program 2027.CPE.0012.00/DT .I.00141.
-- Official record: https://cursos.intecap.edu.gt/detalle/902/2027
-- Accessed 2026-11-03. Level is explicit in the official title/objectives;
-- 100 hours is explicit in the admission details. Category is RutaIA's topic taxonomy.
BEGIN;

INSERT INTO courses (name, description, category, level, duration_hours)
SELECT
    'Programación básica de control lógico programable PLC',
    'Formación para programar funciones básicas en controles lógicos programables (PLC) y controlar actuadores eléctricos y neumáticos, aplicando procedimientos y buenas prácticas de seguridad.',
    'Automatización industrial',
    'Básico',
    100
WHERE NOT EXISTS (
    SELECT 1
    FROM courses
    WHERE lower(name) = lower('Programación básica de control lógico programable PLC')
);

COMMIT;
