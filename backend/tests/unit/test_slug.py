"""Unit tests for app.utils.slug."""
import pytest

from app.utils.slug import ensure_unique_slug, generate_slug


def test_generate_slug_format() -> None:
    """generate_slug produces title-slug plus hyphen and short id."""
    slug = generate_slug("My Test Route")
    assert slug.startswith("my-test-route-")
    rest = slug[len("my-test-route-"):]
    assert len(rest) == 8
    assert rest.isalnum()
    assert slug.isascii()


def test_generate_slug_slugifies_title() -> None:
    """generate_slug normalizes title to lowercase alphanumeric and hyphens."""
    slug = generate_slug("  San Francisco  ")
    assert slug.startswith("san-francisco-")
    assert " " not in slug


def test_ensure_unique_slug_returns_candidate_when_unique() -> None:
    """ensure_unique_slug returns candidate when exists_fn returns False."""
    taken: set[str] = set()

    def exists(s: str) -> bool:
        return s in taken

    out = ensure_unique_slug("my-route-abc12", exists)
    assert out == "my-route-abc12"


def test_ensure_unique_slug_appends_suffix_on_collision() -> None:
    """ensure_unique_slug appends -1, -2, ... when candidate is taken."""
    taken = {"my-route-abc12"}

    def exists(s: str) -> bool:
        return s in taken

    out = ensure_unique_slug("my-route-abc12", exists)
    assert out == "my-route-abc12-1"


def test_ensure_unique_slug_continues_until_unique() -> None:
    """ensure_unique_slug finds first available suffix."""
    taken = {"slug-a", "slug-a-1", "slug-a-2"}

    def exists(s: str) -> bool:
        return s in taken

    out = ensure_unique_slug("slug-a", exists)
    assert out == "slug-a-3"
