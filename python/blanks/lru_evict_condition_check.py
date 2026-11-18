from collections import OrderedDict
from types import SimpleNamespace
from blank import put


def make(capacity):
    return SimpleNamespace(capacity=capacity, items=OrderedDict())


def test_fills_up_without_evicting():
    c = make(3)
    for k in "ABC":
        put(c, k, k.lower())
    assert list(c.items) == ["A", "B", "C"]


def test_evicts_least_recent_when_full():
    c = make(3)
    for k in "ABCD":
        put(c, k, k.lower())
    assert list(c.items) == ["B", "C", "D"]


def test_updating_existing_key_never_evicts():
    c = make(2)
    put(c, "A", "1")
    put(c, "B", "2")
    put(c, "A", "9")
    assert dict(c.items) == {"B": "2", "A": "9"}
