import hashlib
import os
from pathlib import Path

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def connect():
  import psycopg2
  url = os.environ.get("DATABASE_URL")
  if not url:
    raise ValueError("Set DATABASE_URL in the project's .env first.")
  return psycopg2.connect(url)


def store_profiles(profiles):
  conn = connect()
  try:
    with conn, conn.cursor() as cur:
      for user_id, summary, embedding in profiles:
        cur.execute(
          """INSERT INTO user_profiles (user_id, summary_text, embedding)
             VALUES (%s, %s, %s::vector)
             ON CONFLICT (user_id) DO UPDATE SET
               summary_text = EXCLUDED.summary_text, embedding = EXCLUDED.embedding""",
          (user_id, summary, str(embedding.tolist())),
        )
  finally:
    conn.close()

# 1. Initialize Hugging Face model (outputs 384-dimensional vectors)
model = SentenceTransformer("all-MiniLM-L6-v2")


def similarity(summary_a: str, summary_b: str) -> float:
  """Cosine similarity of two summaries, the same number pgvector's <=> gives (1 - distance)."""
  a, b = model.encode([summary_a, summary_b], normalize_embeddings=True)
  # Content IDs let the existing summary-only API persist vectors unchanged.
  store_profiles([
    (hashlib.sha256(text.encode("utf-8")).hexdigest(), text, vector)
    for text, vector in [(summary_a, a), (summary_b, b)]
  ])
  return float(a @ b)


def generate_and_store_profile(user_id: str, summary_paragraph: str):
  """Generates a 384-dim vector from text and saves/updates it in NeonDB."""
  embedding = model.encode(summary_paragraph)
  store_profiles([(user_id, summary_paragraph, embedding)])


def compare_user_profiles(user_id_1: str, user_id_2: str) -> float:
  """Compares two user profiles using pgvector cosine distance calculation."""
  query = """
        SELECT 
            1 - (p1.embedding <=> p2.embedding) AS semantic_similarity
        FROM user_profiles p1, user_profiles p2
        WHERE p1.user_id = %s AND p2.user_id = %s;
    """

  conn = connect()
  try:
    with conn, conn.cursor() as cur:
      cur.execute(query, (user_id_1, user_id_2))
      result = cur.fetchone()
  finally:
    conn.close()

  if result:
    return float(result[0])
  else:
    raise ValueError("One or both user IDs not found in the database.")


# --- Example Test Run ---
if __name__ == "__main__":
  # Notice how these summaries focus on categories/vibes rather than specific names
  user_a_summary = (
      "Enjoys high-intensity workout reels, saves marathon training guides,"
      " and actively leaves supportive comments on friends' fitness posts."
  )
  user_b_summary = (
      "Passionate about endurance running, nutrition guides, and leaving"
      " encouraging comments on peers' athletic achievements."
  )

  generate_and_store_profile("user_alex", user_a_summary)
  generate_and_store_profile("user_sam", user_b_summary)

  # Compare them
  score = compare_user_profiles("user_alex", "user_sam")
  print(f"Vibe Match Similarity Score: {score:.4f}")
