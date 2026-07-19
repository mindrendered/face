
-- Composite indexes for common query patterns

-- Videos: "get my videos filtered by status" (e.g., my queued/ready/failed videos)
CREATE INDEX IF NOT EXISTS idx_videos_user_status ON videos(user_id, status);

-- Series: "get my active series"
CREATE INDEX IF NOT EXISTS idx_series_user_status ON series(user_id, status);

-- Notifications: "get my unread notifications"
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Scheduled posts: "get my pending scheduled posts"
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_status ON scheduled_posts(user_id, status);

-- Scheduled posts: "get upcoming posts for a series"
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_series_scheduled ON scheduled_posts(series_id, scheduled_at);
