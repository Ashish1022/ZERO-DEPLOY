CREATE TABLE IF NOT EXISTS log_events (
    event_id     String,
    deployment_id String,
    log          String,
    timestamp    DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (deployment_id, timestamp);
