CREATE INDEX IF NOT EXISTS idx_posts_text_vector ON public.posts USING ivfflat (text_vector vector_cosine_ops) WITH (lists = 10);
CREATE INDEX IF NOT EXISTS idx_posts_image_vector ON public.posts USING ivfflat (image_vector vector_cosine_ops) WITH (lists = 10);
