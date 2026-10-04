import asyncio
import numpy as np
from sentence_transformers import SentenceTransformer
from spacetimedb_sdk.spacetimedb_async_client import SpacetimeDBAsyncClient

# 1. Initialize Hugging Face model (outputs 384-dimensional vectors)
model = SentenceTransformer("all-MiniLM-L6-v2")


def compute_semantic_similarity(text_1: str, text_2: str) -> float:
  """Runs the Hugging Face algorithm locally to get a similarity score from 0 to 1."""
  embedding_1 = model.encode(text_1)
  embedding_2 = model.encode(text_2)

  # Calculate cosine similarity using vectors
  cosine_sim = np.dot(embedding_1, embedding_2) / (
      np.linalg.norm(embedding_1) * np.linalg.norm(embedding_2)
  )
  return float(cosine_sim)


def on_connect(auth_token, identity):
  print(f"Connected to SpacetimeDB! Client Identity: {identity}")

  # Workflow example:
  # 1. Pull summary texts from the subscribed local cache tables
  # user_a = UserProfile.filter_by_user_id("user_alex")
  # user_b = UserProfile.filter_by_user_id("user_sam")
  #
  # if user_a and user_b:
  #     # 2. Run the algorithm
  #     score = compute_semantic_similarity(user_a.summary_text, user_b.summary_text)
  #     print(f"Computed Vibe Match Score: {score:.4f}")
  #
  #     # 3. Put result back into database via a Reducer call
  #     # save_match_score_reducer.call(user_a.user_id, user_b.user_id, score)


def main():
  # Connect to your local SpacetimeDB instance and subscribe to tables
  asyncio.run(
      SpacetimeDBAsyncClient.run(
          auth_token="",
          host_name="http://localhost:3000",
          module_name="my_instagram_module",  # Replace with your published module name
          on_connect=on_connect,
          queries=["SELECT * FROM user_profiles", "SELECT * FROM profile_matches"],
      )
  )


if __name__ == "__main__":
  main()
