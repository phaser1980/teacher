-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Student sessions table
CREATE TABLE student_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id TEXT,
    game_id TEXT,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP
);

-- Card series table
CREATE TABLE card_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES student_sessions(session_id),
    symbol TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_game TEXT,
    sequence_position INTEGER NOT NULL
);

-- Model results table
CREATE TABLE model_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_series_id UUID REFERENCES card_series(id),
    model_type TEXT NOT NULL,
    result JSONB NOT NULL,
    confidence FLOAT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RNG analysis table
CREATE TABLE rng_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES student_sessions(session_id),
    rng_type TEXT NOT NULL,
    seed_candidate TEXT NOT NULL,
    validation_status BOOLEAN NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confidence_score FLOAT NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_card_series_session ON card_series(session_id);
CREATE INDEX idx_card_series_timestamp ON card_series(timestamp);
CREATE INDEX idx_model_results_card_series ON model_results(card_series_id);
CREATE INDEX idx_rng_analysis_session ON rng_analysis(session_id);

-- Partition card_series table by timestamp
CREATE TABLE card_series_partitioned (
    LIKE card_series INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create partitions for different time ranges
CREATE TABLE card_series_y2024m01 PARTITION OF card_series_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE card_series_y2024m02 PARTITION OF card_series_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
