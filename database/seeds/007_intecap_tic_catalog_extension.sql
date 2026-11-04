-- Additional current INTECAP TIC modules/careers relevant to Java, analytics,
-- and network security. Insert only when the official source publishes hours.
-- Pedagogical levels are RutaIA's classifications, not INTECAP labels.
-- Official details:
-- https://cursos.intecap.edu.gt/detalle/1906/2026 (Java/database module)
-- https://cursos.intecap.edu.gt/detalle/1660/2027 (data analyst)
-- https://cursos.intecap.edu.gt/detalle/1214/2027 (network/security)
-- Hours:
-- https://www.intecap.edu.gt/centrotics/OfertaTICS-2025-final-comprimido.pdf
-- Java module 170 h, Data Analyst 650 h, Network/Security 680 h.

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Desarrollo de aplicaciones en Java y conexión a bases de datos',
       'Desarrolla aplicaciones con interfaz gráfica que administran datos en una base relacional utilizando Java. Este módulo forma parte de la carrera de aplicaciones Java y Android; INTECAP publica 170 horas para este módulo.',
       'Programación', 'Intermedio', NULL, 170,
       'https://cursos.intecap.edu.gt/detalle/1906/2026'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Desarrollo de aplicaciones en Java y conexión a bases de datos'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Analista de datos',
       'Gestiona y organiza datos; recolecta y almacena información; realiza análisis e interpretación con técnicas estadísticas y herramientas especializadas; diseña visualizaciones e informes para apoyar decisiones y resolver problemas empresariales. INTECAP publica 650 horas.',
       'Análisis de datos', 'Avanzado', NULL, 650,
       'https://cursos.intecap.edu.gt/detalle/1660/2027'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Analista de datos'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Administrador de red y seguridad de telecomunicaciones',
       'Planifica, diseña, implementa y mantiene la administración de switches, routers y seguridad en redes, además de implementar infraestructura de redes con base en requerimientos. INTECAP publica 680 horas.',
       'Redes y seguridad', 'Avanzado', NULL, 680,
       'https://cursos.intecap.edu.gt/detalle/1214/2027'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Administrador de red y seguridad de telecomunicaciones'));
