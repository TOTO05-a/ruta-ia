-- Official INTECAP 2027 course detail pages for the curated 20-course catalog.
UPDATE courses AS course
SET source_url = source.url, updated_at = now()
FROM (VALUES
    ('Programación básica de control lógico programable PLC', 'https://cursos.intecap.edu.gt/detalle/902/2027'),
    ('Análisis de datos con Excel y Power BI (E-learning)', 'https://cursos.intecap.edu.gt/detalle/4377/2027'),
    ('Instalación de paneles fotovoltaicos', 'https://cursos.intecap.edu.gt/detalle/905/2027'),
    ('Mantenimiento del sistema de encendido y alimentación de combustible de la motocicleta', 'https://cursos.intecap.edu.gt/detalle/894/2027'),
    ('Manejo y soporte de sistemas informáticos', 'https://cursos.intecap.edu.gt/detalle/1493/2027'),
    ('Administrador de bases de datos Microsoft SQL Server', 'https://cursos.intecap.edu.gt/detalle/1498/2027'),
    ('Técnico en mantenimiento de los sistemas electrónicos del automóvil', 'https://cursos.intecap.edu.gt/detalle/771/2027'),
    ('Mantenimiento del sistema de inyección electrónica de combustible de motocicletas', 'https://cursos.intecap.edu.gt/detalle/881/2027'),
    ('Electromecánico', 'https://cursos.intecap.edu.gt/detalle/755/2027'),
    ('Electricista instalador domiciliar', 'https://cursos.intecap.edu.gt/detalle/896/2027'),
    ('Mecánico de refrigeración y aire acondicionado', 'https://cursos.intecap.edu.gt/detalle/1097/2027'),
    ('Mecánico de motocicletas', 'https://cursos.intecap.edu.gt/detalle/868/2027'),
    ('Aplicación de soldadura oxiacetilénica en equipos de refrigeración y aire acondicionado', 'https://cursos.intecap.edu.gt/detalle/1490/2027'),
    ('Cocina saludable', 'https://cursos.intecap.edu.gt/detalle/1847/2027'),
    ('Repostero', 'https://cursos.intecap.edu.gt/detalle/1851/2027'),
    ('Sastre', 'https://cursos.intecap.edu.gt/detalle/1772/2027'),
    ('Aplicación de pintura de poliuretano', 'https://cursos.intecap.edu.gt/detalle/886/2027'),
    ('Maridaje gastronómico de alimentos y bebidas', 'https://cursos.intecap.edu.gt/detalle/1843/2027'),
    ('Cocinero de pequeños negocios', 'https://cursos.intecap.edu.gt/detalle/1799/2027'),
    ('Cocinero', 'https://cursos.intecap.edu.gt/detalle/1759/2027')
) AS source(name, url)
WHERE course.name = source.name
  AND course.source_url IS DISTINCT FROM source.url;
