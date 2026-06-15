import tempfile
import unittest
from pathlib import Path

from server import read_lorem_words


class ReadLoremWordsTest(unittest.TestCase):
    def test_returns_requested_number_of_words(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            source = Path(tmp_dir) / "lorem-ipsum.md"
            source.write_text("one two three four five", encoding="utf-8")

            self.assertEqual(read_lorem_words(3, source), "one two three")

    def test_defaults_to_thirty_words(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            source = Path(tmp_dir) / "lorem-ipsum.md"
            words = [f"word{i}" for i in range(35)]
            source.write_text(" ".join(words), encoding="utf-8")

            result = read_lorem_words(source_path=source)

            self.assertEqual(len(result.split()), 30)
            self.assertEqual(result.split()[0], "word0")
            self.assertEqual(result.split()[-1], "word29")


if __name__ == "__main__":
    unittest.main()
