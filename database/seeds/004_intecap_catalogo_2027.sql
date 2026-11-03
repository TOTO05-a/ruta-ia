-- INTECAP official 2027 offers. URLs and published hours are recorded per row.
-- `level` is RutaIA's pedagogical classification from published objectives and
-- prerequisites; it is not INTECAP's occupational type. These pages do not
-- state CTO/CTM/CTMS, so `intecap_career_type` intentionally remains NULL.
-- Sources:
-- https://cursos.intecap.edu.gt/detalle/1493/2027 (Manejo y soporte, 300 h)
-- https://cursos.intecap.edu.gt/detalle/1498/2027 (SQL Server, 720 h)
-- https://cursos.intecap.edu.gt/detalle/771/2027 (electrónica automotriz, 555 h)
-- https://cursos.intecap.edu.gt/detalle/881/2027 (inyección electrónica moto, 80 h)
-- https://cursos.intecap.edu.gt/detalle/755/2027 (Electromecánico, 500 h + 300 h práctica separada)
-- https://cursos.intecap.edu.gt/detalle/896/2027 (Electricista domiciliar, 635 h + 300 h práctica separada)
-- https://cursos.intecap.edu.gt/detalle/1097/2027 (refrigeración y A/C, 1,175 h + 300 h práctica separada)
-- https://cursos.intecap.edu.gt/detalle/868/2027 (Mecánico de motocicletas, 1,060 h + 300 h práctica separada)
-- https://cursos.intecap.edu.gt/detalle/1490/2027 (soldadura oxiacetilénica, 90 h)
-- https://cursos.intecap.edu.gt/detalle/1847/2027 (Cocina saludable, 80 h)
-- https://cursos.intecap.edu.gt/detalle/1851/2027 (Repostero, 780 h + 80 h práctica en producción separada)
-- https://cursos.intecap.edu.gt/detalle/1772/2027 (Sastre, 620 h)
-- https://cursos.intecap.edu.gt/detalle/886/2027 (Pintura de poliuretano, 200 h)
-- https://cursos.intecap.edu.gt/detalle/1843/2027 (Maridaje gastronómico, 100 h)
-- https://cursos.intecap.edu.gt/detalle/1799/2027 (Cocinero de pequeños negocios, 260 h)
-- https://cursos.intecap.edu.gt/detalle/1759/2027 (Cocinero, 1,020 h + 400 h práctica separada)

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Manejo y soporte de sistemas informáticos',
       'Configuración de sistemas operativos, herramientas web colaborativas y aplicaciones ofimáticas para gestionar información, además de mantenimiento básico de hardware y software. No requiere experiencia previa.',
       'Informática', 'Básico', NULL, 300
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Manejo y soporte de sistemas informáticos'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Administrador de bases de datos Microsoft SQL Server',
       'Gestión y organización de datos; diseño de visualizaciones y reportes; y administración de bases relacionales y no relacionales con atención a integridad, disponibilidad, seguridad y rendimiento. Requiere título de nivel medio y conocimientos básicos de Windows y Office.',
       'Bases de datos', 'Avanzado', NULL, 720
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Administrador de bases de datos Microsoft SQL Server'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Técnico en mantenimiento de los sistemas electrónicos del automóvil',
       'Mantenimiento de sistemas electrónicos de carga y arranque, frenos ABS y control de tracción, dirección asistida, motor y transmisión del automóvil. Dirigido a personas con formación profesional en mecánica automotriz o experiencia equivalente.',
       'Mecánica automotriz', 'Avanzado', NULL, 555
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Técnico en mantenimiento de los sistemas electrónicos del automóvil'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Mantenimiento del sistema de inyección electrónica de combustible de motocicletas',
       'Detección de fallas y reparación del sistema de inyección electrónica de combustible de motocicletas con procedimientos y buenas prácticas. Formación modular de especialidad, sin experiencia previa requerida.',
       'Mecánica de motocicletas', 'Intermedio', NULL, 80
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Mantenimiento del sistema de inyección electrónica de combustible de motocicletas'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Electromecánico',
       'Detección de fallas y mantenimiento preventivo y correctivo de sistemas eléctricos y electrónicos del automóvil. La ficha publica 500 horas de formación y 300 horas de práctica empresarial por separado.',
       'Mecánica automotriz', 'Intermedio', NULL, 500
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Electromecánico'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Electricista instalador domiciliar',
       'Instalación y mantenimiento de circuitos eléctricos domiciliares, sistemas solares y motores monofásicos. La ficha publica 635 horas de formación y 300 horas de práctica empresarial por separado; no requiere experiencia previa.',
       'Electricidad', 'Básico', NULL, 635
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Electricista instalador domiciliar'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Mecánico de refrigeración y aire acondicionado',
       'Mantenimiento de equipos frigoríficos domésticos y comerciales, sistemas industriales y aire acondicionado residencial, comercial y automotriz. La ficha publica 1,175 horas de formación y 300 horas de práctica empresarial por separado.',
       'Refrigeración y climatización', 'Intermedio', NULL, 1175
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Mecánico de refrigeración y aire acondicionado'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Mecánico de motocicletas',
       'Mantenimiento de sistemas eléctricos, electrónicos, frenos, suspensión, dirección, transmisión y motor de combustión interna de motocicletas. La ficha publica 1,060 horas de formación y 300 horas de práctica empresarial por separado; no requiere experiencia previa.',
       'Mecánica de motocicletas', 'Básico', NULL, 1060
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Mecánico de motocicletas'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Aplicación de soldadura oxiacetilénica en equipos de refrigeración y aire acondicionado',
       'Preparación y aplicación de soldadura oxiacetilénica, localización y reparación de fugas o reemplazo de tuberías metálicas en equipos de refrigeración y aire acondicionado. Requiere conocimientos previos y licencia vigente de técnico frigorista.',
       'Refrigeración y climatización', 'Avanzado', NULL, 90
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Aplicación de soldadura oxiacetilénica en equipos de refrigeración y aire acondicionado'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Cocina saludable',
       'Planificación de menús saludables y equilibrados a partir de grupos básicos de alimentos y elaboración de productos con procedimientos de seguridad e higiene. No requiere experiencia previa.',
       'Gastronomía', 'Básico', NULL, 80
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Cocina saludable'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Repostero',
       'Preparación de instalaciones, equipos y materiales; elaboración, decoración, montaje y presentación de productos de repostería. La ficha distingue 780 horas de formación y 80 horas prácticas en producción.',
       'Gastronomía', 'Básico', NULL, 780
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Repostero'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Sastre',
       'Preparación de equipo y materiales; trazo, corte, confección y acabados de prendas de sastrería. La oferta 2027 publica 620 horas de formación y no requiere experiencia previa.',
       'Confección y diseño', 'Básico', NULL, 620
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Sastre'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Aplicación de pintura de poliuretano',
       'Aplicación de pintura y barnices de poliuretano y acabados finales en superficies de automóviles. La ficha requiere conocimientos básicos de preparación de superficies y experiencia en la especialidad.',
       'Mecánica automotriz', 'Intermedio', NULL, 200
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Aplicación de pintura de poliuretano'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Maridaje gastronómico de alimentos y bebidas',
       'Aplicación de principios de maridaje para armonizar preparaciones de cocina y repostería internacional con bebidas, considerando criterios sensoriales, culturales, técnicos y contextuales. Dirigido a egresados o trabajadores del área de alimentos y bebidas.',
       'Gastronomía', 'Avanzado', NULL, 100
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Maridaje gastronómico de alimentos y bebidas'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Cocinero de pequeños negocios',
       'Preparación de platos básicos de cocina caliente y fría, así como platos populares, aplicando prácticas de higiene, seguridad industrial y conservación ambiental. La ficha indica experiencia no necesaria y publica 260 horas de formación.',
       'Gastronomía', 'Básico', NULL, 260
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Cocinero de pequeños negocios'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT 'Cocinero',
       'Preparación de instalaciones, equipos y materiales; elaboración, montaje y presentación de preparaciones culinarias nacionales e internacionales con buenas prácticas laborales. La ficha publica 1,020 horas de formación y 400 horas de práctica empresarial por separado.',
       'Gastronomía', 'Básico', NULL, 1020
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Cocinero'));
