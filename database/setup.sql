-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);

-- Create symbols table
CREATE TABLE IF NOT EXISTS symbols (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    symbol INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sequence_position INTEGER NOT NULL
);

-- Create analysis_results table
CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    model_name VARCHAR(50) NOT NULL,
    prediction JSONB NOT NULL,
    confidence FLOAT NOT NULL,
    rng_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indices
CREATE INDEX IF NOT EXISTS idx_symbols_session ON symbols(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_session ON analysis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_symbols_timestamp ON symbols(timestamp);

-- Create function to update session last_active
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions 
    SET last_active = CURRENT_TIMESTAMP 
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_session_last_active
    AFTER INSERT ON symbols
    FOR EACH ROW
    EXECUTE FUNCTION update_session_timestamp();
