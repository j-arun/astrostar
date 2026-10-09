-- ===============================================================================
-- TABLE: llm_prompt_logs (LLM Ingestion & Inference Audit Log)
-- Tracks prompts, responses, duration, and metadata across Gemini, Ollama, and Claude.
-- ===============================================================================

CREATE SEQUENCE IF NOT EXISTS llm_prompt_log_seq
    MINVALUE 1
    MAXVALUE 100
    START WITH 1
    INCREMENT BY 1
    CYCLE;

CREATE TABLE IF NOT EXISTS llm_prompt_logs (
    id SERIAL PRIMARY KEY,
    log_id VARCHAR(64) UNIQUE NOT NULL,             -- e.g. 'LOG-GEMINI-014-20261009123045'
    running_number INTEGER NOT NULL,                -- Cycling sequence 1 to 100
    engine VARCHAR(50) NOT NULL,                    -- 'Gemini', 'Ollama', or 'Claude'
    model_name VARCHAR(100),                        -- Specific model: 'gemini-3.8-flash', 'qwen2.5:7b-instruct', etc.
    fired_at TIMESTAMP WITH TIME ZONE NOT NULL,     -- Time when the prompt was fired
    prompt_text TEXT NOT NULL,                      -- Full prompt text sent
    response_text TEXT NOT NULL,                    -- Response text received
    time_taken_ms INTEGER NOT NULL,                 -- Execution duration in milliseconds
    status VARCHAR(30) DEFAULT 'SUCCESS',           -- 'SUCCESS', 'FALLBACK', or 'ERROR'
    response_json JSONB,                            -- Optional raw JSON response / stats
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_llm_prompt_logs_engine ON llm_prompt_logs(engine);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_logs_fired_at ON llm_prompt_logs(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_logs_running ON llm_prompt_logs(running_number);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_logs_status ON llm_prompt_logs(status);

-- Verification Query
COMMENT ON TABLE llm_prompt_logs IS 'Transaction audit table for LLM inference prompts and responses across Ollama, Gemini, and Claude';
