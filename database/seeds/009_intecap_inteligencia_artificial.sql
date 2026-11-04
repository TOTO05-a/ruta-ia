-- Additional official INTECAP AI offerings with hours calculated from their
-- published calendar (date range, weekdays, and session times).
-- Scheduled hours are not represented as institution-published curriculum hours.

INSERT INTO courses (name, description, category, level, duration_hours, source_url)
SELECT 'Interacción y multimedia con IA',
       'Evento básico para identificar principios de inteligencia artificial y sus aplicaciones en procesamiento de lenguaje, organizadores gráficos y multimedia generativa. INTECAP lo dirige a personas interesadas en apoyar proyectos de IA y análisis de datos. Duración calculada desde el calendario oficial: seis sábados, 08:00–16:30, del 31/10/2026 al 05/12/2026 = 51 horas programadas; no se descontaron pausas que la ficha no especifica.',
       'Inteligencia artificial', 'Básico', 51,
       'https://cursos.intecap.edu.gt/detalle/46350/2026'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Interacción y multimedia con IA'));

INSERT INTO courses (name, description, category, level, duration_hours, source_url)
SELECT 'Administración de Excel intermedio con herramientas de IA',
       'Capacitación intermedia en hojas de cálculo, informes dinámicos y asistentes de inteligencia artificial para optimizar fórmulas, automatizar análisis de datos y resolver problemas. Duración calculada desde el calendario oficial: diez sesiones, martes y miércoles de 18:00 a 21:00, del 10/11/2026 al 09/12/2026 = 30 horas programadas.',
       'Inteligencia artificial', 'Intermedio', 30,
       'https://cursos.intecap.edu.gt/detalle/46366/2026'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Administración de Excel intermedio con herramientas de IA'));

INSERT INTO courses (name, description, category, level, duration_hours, source_url)
SELECT 'Inteligencia artificial aplicada a marketing digital para emprendedores',
       'Curso básico para conocer conceptos de marketing digital y manejar herramientas de inteligencia artificial para planificar contenidos y apoyar el crecimiento de negocios. Dirigido a emprendedores y personas con un proyecto de negocio activo. Duración calculada desde el calendario oficial: seis miércoles de 12:45 a 16:30, del 11/11/2026 al 16/12/2026 = 22.5 horas programadas.',
       'Inteligencia artificial', 'Básico', 22.5,
       'https://cursos.intecap.edu.gt/detalle/47794/2026'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Inteligencia artificial aplicada a marketing digital para emprendedores'));
