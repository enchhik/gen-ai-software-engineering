from pathlib import Path
from typing import Optional

LOREM_PATH = Path(__file__).with_name("lorem-ipsum.md")


def read_lorem_words(word_count: int = 30, source_path: Optional[Path] = None) -> str:
    if word_count < 0:
        raise ValueError("word_count must be non-negative")

    path = source_path or LOREM_PATH
    words = path.read_text(encoding="utf-8").split()
    return " ".join(words[:word_count])


def create_server():
    from fastmcp import FastMCP

    mcp = FastMCP("Homework 5 Lorem MCP")

    @mcp.resource("lorem://content")
    def lorem_default() -> str:
        """Return the first 30 words from lorem-ipsum.md."""
        return read_lorem_words()

    @mcp.resource("lorem://content/{word_count}")
    def lorem_resource(word_count: int = 30) -> str:
        """Return exactly word_count words from lorem-ipsum.md."""
        return read_lorem_words(word_count)

    @mcp.tool(name="read")
    def read(word_count: int = 30) -> str:
        """Read word-limited lorem ipsum content."""
        return read_lorem_words(word_count)

    return mcp


if __name__ == "__main__":
    create_server().run()
