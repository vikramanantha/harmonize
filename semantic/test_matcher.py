"""Storage/scoring regression checks without downloading the model or calling Neon."""
import hashlib
import runpy
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


class Vector:
  def __init__(self, first, second):
    self.values = [first, second] + [0.0] * 382

  def tolist(self):
    return self.values

  def __matmul__(self, other):
    return sum(a * b for a, b in zip(self.values, other.values))


class MatcherTest(unittest.TestCase):
  def setUp(self):
    self.model = MagicMock()
    self.connection = MagicMock()
    self.cursor = self.connection.cursor.return_value.__enter__.return_value
    self.connect = MagicMock(return_value=self.connection)
    self.dotenv = MagicMock()
    with patch.dict("sys.modules", {
      "sentence_transformers": SimpleNamespace(SentenceTransformer=lambda name: self.model),
      "dotenv": SimpleNamespace(load_dotenv=self.dotenv),
      "psycopg2": SimpleNamespace(connect=self.connect),
    }):
      self.matcher = runpy.run_path(str(Path(__file__).with_name("matcher.py")))
    self.modules = patch.dict("sys.modules", {"psycopg2": SimpleNamespace(connect=self.connect)})
    self.modules.start()
    self.env = patch.dict("os.environ", {"DATABASE_URL": "postgresql://demo:demo@demo.neon.tech/neondb"})
    self.env.start()

  def tearDown(self):
    self.env.stop()
    self.modules.stop()

  def test_active_scoring_keeps_normalization_and_dot_product(self):
    a, b = Vector(0.6, 0.8), Vector(0.8, 0.6)
    self.model.encode.return_value = [a, b]
    self.assertEqual(self.matcher["similarity"]("summary a", "summary b"), a @ b)
    self.model.encode.assert_called_once_with(["summary a", "summary b"], normalize_embeddings=True)
    writes = self.cursor.execute.call_args_list
    self.assertEqual(len(writes), 2)
    self.assertEqual(writes[0].args[1], (
      hashlib.sha256(b"summary a").hexdigest(), "summary a", str(a.tolist()),
    ))
    self.assertEqual(len(a.tolist()), 384)
    self.connection.close.assert_called_once()

  def test_standalone_profile_generation_keeps_existing_encoding(self):
    vector = Vector(2.0, 3.0)
    self.model.encode.return_value = vector
    self.matcher["generate_and_store_profile"]("user_a", "summary")
    self.model.encode.assert_called_once_with("summary")
    self.assertEqual(self.cursor.execute.call_args.args[1], ("user_a", "summary", str(vector.tolist())))

  def test_standalone_comparison_keeps_cosine_distance(self):
    self.cursor.fetchone.return_value = (0.73,)
    self.assertEqual(self.matcher["compare_user_profiles"]("a", "b"), 0.73)
    self.assertIn("1 - (p1.embedding <=> p2.embedding)", self.cursor.execute.call_args.args[0])
    self.assertEqual(self.cursor.execute.call_args.args[1], ("a", "b"))

  def test_storage_failure_closes_connection_and_propagates(self):
    self.model.encode.return_value = [Vector(1, 0), Vector(0, 1)]
    self.cursor.execute.side_effect = RuntimeError("database unavailable")
    with self.assertRaisesRegex(RuntimeError, "database unavailable"):
      self.matcher["similarity"]("a", "b")
    self.connection.close.assert_called_once()


if __name__ == "__main__":
  unittest.main()
