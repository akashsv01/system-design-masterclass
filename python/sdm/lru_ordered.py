from collections import OrderedDict
from typing import Optional


class LRUCache:
    """Same behaviour as sdm.lru_cache, using the standard library.

    OrderedDict remembers insertion order and can move a key to the end in O(1),
    so "end" plays the role of "most recently used".
    """

    def __init__(self, capacity: int):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self.capacity = capacity
        self.items: OrderedDict[str, str] = OrderedDict()

    def get(self, key: str) -> Optional[str]:
        if key not in self.items:
            return None
        self.items.move_to_end(key)
        return self.items[key]

    def put(self, key: str, value: str) -> None:
        if key in self.items:
            self.items.move_to_end(key)
        elif len(self.items) == self.capacity:
            self.items.popitem(last=False)  # remove the oldest = least recently used
        self.items[key] = value

    def keys_by_recency(self) -> list[str]:
        return list(reversed(self.items))
