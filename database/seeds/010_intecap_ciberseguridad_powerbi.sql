-- Official INTECAP events with November/December 2026 schedules.
-- duration_hours is calculated from the published calendar; it is not an
-- institution-published curriculum-hour total.

INSERT INTO courses (name, description, category, level, duration_hours, source_url)
SELECT 'Power BI intermedio',
       'Curso intermedio para modelizar y analizar datos y presentarlos mediante paneles e informes. Requisito publicado: haber aprobado Power BI Básico. Duración calculada desde el calendario oficial: cuatro sábados, de 08:00 a 12:00, del 21/11/2026 al 12/12/2026 = 16 horas programadas; la ficha no publica un total curricular.',
       'Análisis de datos', 'Intermedio', 16,
       'https://cursos.intecap.edu.gt/detalle/45525/2026'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Power BI intermedio'));

INSERT INTO courses (name, description, category, level, duration_hours, source_url)
SELECT 'Fortinet: FortiGate Administrator',
       'Curso avanzado de administración de firewall: políticas, autenticación de usuarios, VPN SSL/IPsec y Fortinet Security Fabric para proteger redes. Requisito publicado: certificación Fortinet Associate FCA. Duración calculada desde el calendario oficial: 17 sesiones de lunes, miércoles y jueves, de 18:00 a 22:00, del 04/11/2026 al 10/12/2026 = 68 horas programadas; no se descontaron feriados o pausas no especificados.',
       'Ciberseguridad', 'Avanzado', 68,
       'https://cursos.intecap.edu.gt/detalle/45419/2026'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Fortinet: FortiGate Administrator'));

INSERT INTO courses (name, description, category, level, duration_hours, source_url)
SELECT 'Fortinet: fundamentos de ciberseguridad, nube y firewalls de próxima generación',
       'Curso básico sobre fundamentos de ciberseguridad, nube, amenazas en redes y firewalls de próxima generación para entornos empresariales. La ficha lo describe como e-learning asíncrono con acceso 24/7 y ritmo propio. Duración programada calculada del horario publicado: 25 días hábiles, de lunes a viernes de 14:00 a 16:00, del 02/11/2026 al 04/12/2026 = 50 horas; no es una carga curricular publicada y el esfuerzo real puede variar por la modalidad asíncrona.',
       'Ciberseguridad', 'Básico', 50,
       'https://cursos.intecap.edu.gt/detalle/40370/2026'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE lower(name) = lower('Fortinet: fundamentos de ciberseguridad, nube y firewalls de próxima generación'));
