-- Official INTECAP 2027 modular offers. Source facts are linked per record.
-- `level` is RutaIA's pedagogical estimate based on stated prerequisites and
-- objectives; it is not INTECAP's CTO/CTM/CTMS classification. These offers do
-- not state a career type, so intecap_career_type intentionally remains NULL.

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT
    'Instalación de paneles fotovoltaicos',
    'Formación modular para montar y conectar la estructura de soporte y los subsistemas de generación, regulación, acumulación, acondicionamiento y protección de paneles fotovoltaicos, aplicando seguridad personal y protección ambiental. Requiere un año de experiencia comprobable en el área o una credencial de electricidad.',
    'Energía renovable',
    'Intermedio',
    NULL,
    140
WHERE NOT EXISTS (
    SELECT 1 FROM courses WHERE lower(name) = lower('Instalación de paneles fotovoltaicos')
);

INSERT INTO courses (name, description, category, level, intecap_career_type, duration_hours)
SELECT
    'Mantenimiento del sistema de encendido y alimentación de combustible de la motocicleta',
    'Formación modular para realizar mantenimiento básico al sistema de encendido y alimentación de combustible de motocicletas, aplicando procedimientos y buenas prácticas. La ficha indica que no requiere experiencia previa.',
    'Mecánica de motocicletas',
    'Básico',
    NULL,
    80
WHERE NOT EXISTS (
    SELECT 1 FROM courses WHERE lower(name) = lower('Mantenimiento del sistema de encendido y alimentación de combustible de la motocicleta')
);
