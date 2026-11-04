-- Additional official 2026–2027 INTECAP TIC offerings to cover the academic
-- query domains (web development, Java and cybersecurity).
-- Hours are published by INTECAP in its TICS brochures/specialty page:
-- Java/Android 730 h; Full Stack 650 h; cybersecurity 560 h; web PHP/MySQL
-- 300 h. The didactic `level` is RutaIA's classification from objectives and
-- prerequisites; INTECAP occupational type is kept separate and NULL where
-- the course page does not identify CTO/CTM/CTMS.
-- Detail pages:
-- https://cursos.intecap.edu.gt/detalle/820/2027 (Java and Android)
-- https://cursos.intecap.edu.gt/detalle/1351/2027 (Full Stack)
-- https://cursos.intecap.edu.gt/detalle/1054/2027 (cybersecurity)
-- https://cursos.intecap.edu.gt/detalle/11415/2026 (web PHP/MySQL)
-- Duration sources:
-- https://www.intecap.edu.gt/centrotics/Unifoliar%20Tics%20Admisiones%202025.pdf
-- https://www.intecap.edu.gt/centrotics/OfertaTICS-2025-final-comprimido.pdf
-- https://www.intecap.edu.gt/centros/centrosanmarcos/informatica/

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Desarrollador de aplicaciones para Java y Android',
       'Analiza requerimientos, planifica, diseña, implementa y mantiene aplicaciones con Java y Android. La carrera requiere título o diploma de nivel medio y conocimientos básicos de Windows y Office; la experiencia previa no es necesaria. INTECAP publica 730 horas.',
       'Programación', 'Intermedio', NULL, 730,
       'https://cursos.intecap.edu.gt/detalle/820/2027'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Desarrollador de aplicaciones para Java y Android'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Desarrollador Full Stack',
       'Formación para desarrollar aplicaciones Full Stack y desempeñarse en organizaciones que requieren este perfil. La convocatoria 2027 requiere título o diploma de nivel medio; el folleto oficial de TICS publica 650 horas.',
       'Desarrollo web', 'Avanzado', NULL, 650,
       'https://cursos.intecap.edu.gt/detalle/1351/2027'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Desarrollador Full Stack'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Administrador de ciberseguridad',
       'Analiza amenazas y mitiga ataques cibernéticos en redes para fortalecer la resiliencia de organizaciones y apoyar funciones de seguridad. Requiere diploma de nivel medio y dominio básico de Windows y Office; la experiencia no es necesaria. INTECAP publica 560 horas.',
       'Ciberseguridad', 'Avanzado', NULL, 560,
       'https://cursos.intecap.edu.gt/detalle/1054/2027'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Administrador de ciberseguridad'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Desarrollo web con PHP y MySQL',
       'Crea bases de datos según requerimientos de software y construye aplicaciones con PHP y MySQL de acuerdo con necesidades del cliente, aplicando buenas prácticas. Requiere conocimientos básicos de Windows; no requiere experiencia previa. La oferta oficial publica 300 horas.',
       'Desarrollo web', 'Básico', NULL, 300,
       'https://cursos.intecap.edu.gt/detalle/11415/2026'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Desarrollo web con PHP y MySQL'));
