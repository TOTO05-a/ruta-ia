CREATE TABLE course_qdrant_sync_outbox (
    id BIGSERIAL PRIMARY KEY,
    course_id UUID NOT NULL UNIQUE,
    action TEXT NOT NULL CHECK (action IN ('upsert', 'delete')),
    version BIGINT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX course_qdrant_sync_outbox_due_idx
    ON course_qdrant_sync_outbox (available_at, locked_until);

CREATE FUNCTION enqueue_course_qdrant_sync() RETURNS trigger AS $$
DECLARE
    sync_action TEXT;
    sync_payload JSONB;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.name IS NOT DISTINCT FROM OLD.name AND
           NEW.description IS NOT DISTINCT FROM OLD.description AND
           NEW.category IS NOT DISTINCT FROM OLD.category AND
           NEW.level IS NOT DISTINCT FROM OLD.level AND
           NEW.intecap_career_type IS NOT DISTINCT FROM OLD.intecap_career_type AND
           NEW.duration_hours IS NOT DISTINCT FROM OLD.duration_hours AND
           NEW.source_url IS NOT DISTINCT FROM OLD.source_url AND
           NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
            RETURN NEW;
        END IF;
    END IF;

    sync_action := CASE WHEN NEW.is_active THEN 'upsert' ELSE 'delete' END;
    sync_payload := jsonb_build_object(
        'id', NEW.id,
        'name', NEW.name,
        'description', NEW.description,
        'category', NEW.category,
        'level', NEW.level,
        'intecapCareerType', NEW.intecap_career_type,
        'durationHours', NEW.duration_hours,
        'sourceUrl', NEW.source_url,
        'isActive', NEW.is_active
    );

    INSERT INTO course_qdrant_sync_outbox (course_id, action, payload)
    VALUES (NEW.id, sync_action, sync_payload)
    ON CONFLICT (course_id) DO UPDATE SET
        action = EXCLUDED.action,
        payload = EXCLUDED.payload,
        version = course_qdrant_sync_outbox.version + 1,
        attempts = 0,
        available_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER courses_enqueue_qdrant_sync
AFTER INSERT OR UPDATE OF name, description, category, level, intecap_career_type,
    duration_hours, source_url, is_active ON courses
FOR EACH ROW EXECUTE FUNCTION enqueue_course_qdrant_sync();
