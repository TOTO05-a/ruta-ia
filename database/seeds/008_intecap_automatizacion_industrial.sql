-- Official INTECAP industrial programs with curriculum hours published by the institution.
-- The pedagogical level is RutaIA's classification; practice hours remain explicit in the description.
-- Source: https://www.intecap.edu.gt/centros/centrobajaverapaz/industrial/

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Automatización Industrial',
       'Formación para elaborar diagramas, montar y conectar sistemas automatizados, configurar controladores y redes de comunicación, programar y simular procesos secuenciales y continuos, y poner en marcha sistemas de automatización industrial. INTECAP publica 360 horas. La especialidad requiere formación previa y experiencia afín en electricidad, electrónica o áreas relacionadas.',
       'Automatización industrial', 'Avanzado', NULL, 360,
       'https://www.intecap.edu.gt/centros/centrobajaverapaz/industrial/'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Automatización Industrial'));

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours, source_url)
SELECT 'Instrumentista Industrial',
       'Carrera orientada a formular e implementar soluciones para instalar y mantener sistemas de control de actuadores eléctricos, circuitos neumáticos e hidráulicos, programar controladores lógicos programables, controlar y medir procesos industriales e instalar y mantener comunicación industrial. INTECAP publica 540 horas de formación y 300 horas de práctica por separado.',
       'Automatización industrial', 'Avanzado', NULL, 540,
       'https://www.intecap.edu.gt/centros/centrobajaverapaz/industrial/'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Instrumentista Industrial'));
