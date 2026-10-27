ALTER TABLE documents ADD COLUMN commentId TEXT REFERENCES comments(id);
