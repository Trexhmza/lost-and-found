CREATE OR REPLACE FUNCTION vector_search_candidates(
  p_type text,
  p_user_id uuid,
  p_text_vec text DEFAULT NULL,
  p_img_vec text DEFAULT NULL,
  p_use_both boolean DEFAULT false,
  p_limit int DEFAULT 15
)
RETURNS SETOF posts
LANGUAGE sql STABLE
AS $$
  WITH scored AS (
    SELECT p.id,
      CASE
        WHEN p.text_vector IS NOT NULL AND p_text_vec IS NOT NULL THEN
          1 - (p.text_vector <=> p_text_vec::vector)
        ELSE 0
      END AS text_sim,
      CASE
        WHEN p.image_vector IS NOT NULL AND p_img_vec IS NOT NULL THEN
          1 - (p.image_vector <=> p_img_vec::vector)
        ELSE 0
      END AS img_sim
    FROM posts p
    WHERE p.type = p_type
      AND p.status = 'active'
      AND p.user_id != p_user_id
  ),
  ranked AS (
    SELECT s.id,
      CASE
        WHEN p_use_both THEN s.text_sim * 0.5 + s.img_sim * 0.5
        WHEN p_text_vec IS NOT NULL THEN s.text_sim
        WHEN p_img_vec IS NOT NULL THEN s.img_sim
        ELSE 0
      END AS score
    FROM scored s
    ORDER BY score DESC
    LIMIT p_limit
  )
  SELECT p.*
  FROM posts p
  INNER JOIN ranked r ON p.id = r.id
  ORDER BY r.score DESC;
$$;
