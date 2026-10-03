import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

# 1. Initialize Hugging Face model (outputs 384-dimensional vectors)
model = SentenceTransformer("all-MiniLM-L6-v2")

# Replace with your actual NeonDB connection string
DATABASE_URL = "postgresql://user:password@your-neon-host.neon.tech/neondb?sslmode=require"


def generate_and_store_profile(user_id: str, summary_paragraph: str):
  """Generates a 384-dim vector from text and saves/updates it in NeonDB."""
  embedding = model.encode(summary_paragraph).tolist()

  conn = psycopg2.connect(DATABASE_URL)
  register_vector(conn)  # Tells psycopg2 how to handle vector types
  cur = conn.cursor()

  cur.execute(
      """
        INSERT INTO user_profiles (user_id, summary_text, embedding)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id) 
        DO UPDATE SET summary_text = EXCLUDED.summary_text, embedding = EXCLUDED.embedding;
    """,
        (user_id, summary_paragraph, embedding),
  )

  conn.commit()
  cur.close()
  conn.close()


def compare_user_profiles(user_id_1: str, user_id_2: str) -> float:
  """Compares two user profiles using pgvector cosine distance calculation."""
  conn = psycopg2.connect(DATABASE_URL)
  register_vector(conn)
  cur = conn.cursor()

  query = """
        SELECT 
            1 - (p1.embedding <=> p2.embedding) AS semantic_similarity
        FROM user_profiles p1, user_profiles p2
        WHERE p1.user_id = %s AND p2.user_id = %s;
    """

  cur.execute(query, (user_id_1, user_id_2))
  result = cur.fetchone()

  cur.close()
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