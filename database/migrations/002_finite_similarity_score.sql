ALTER TABLE recommendation_sources
    DROP CONSTRAINT recommendation_sources_similarity_score_check,
    ADD CONSTRAINT recommendation_sources_similarity_score_finite_check
        CHECK (
            similarity_score > '-Infinity'::numeric
            AND similarity_score < 'Infinity'::numeric
        );
