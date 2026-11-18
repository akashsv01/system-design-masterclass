import pytest

from sdm import lru_cache, lru_ordered


@pytest.fixture(params=[lru_cache.LRUCache, lru_ordered.LRUCache], ids=["linked-list", "ordereddict"])
def make(request):
    return request.param


def test_read_protects_item_from_eviction(make):
    c = make(3)
    for k in "ABC":
        c.put(k, k.lower())
    assert c.get("A") == "a"
    assert c.keys_by_recency() == ["A", "C", "B"]
    c.put("D", "d")
    assert c.get("B") is None
    assert c.keys_by_recency() == ["D", "A", "C"]


def test_update_existing_key_does_not_evict(make):
    c = make(2)
    c.put("A", "1")
    c.put("B", "2")
    c.put("A", "9")
    assert c.keys_by_recency() == ["A", "B"]
    assert c.get("A") == "9"


def test_miss_changes_nothing(make):
    c = make(2)
    c.put("A", "1")
    assert c.get("Z") is None
    assert c.keys_by_recency() == ["A"]


def test_capacity_one(make):
    c = make(1)
    c.put("A", "1")
    c.put("B", "2")
    assert c.keys_by_recency() == ["B"]


def test_rejects_zero_capacity(make):
    with pytest.raises(ValueError):
        make(0)


def test_matches_reference_model_on_random_operations():
    import random

    rng = random.Random(7)
    a, b = lru_cache.LRUCache(4), lru_ordered.LRUCache(4)
    for _ in range(2000):
        k = rng.choice("ABCDEFG")
        if rng.random() < 0.5:
            assert a.get(k) == b.get(k)
        else:
            v = str(rng.randint(0, 99))
            a.put(k, v)
            b.put(k, v)
        assert a.keys_by_recency() == b.keys_by_recency()
