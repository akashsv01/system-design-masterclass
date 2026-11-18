from typing import Optional


class Node:
    """One entry in the recency list."""

    def __init__(self, key: str, value: str):
        self.key = key
        self.value = value
        self.prev: Optional["Node"] = None
        self.next: Optional["Node"] = None


class LRUCache:
    """Keeps at most `capacity` entries and forgets the least recently used one."""

    def __init__(self, capacity: int):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self.capacity = capacity
        self.index: dict[str, Node] = {}   # key -> node, for O(1) lookup
        self.head: Optional[Node] = None   # most recently used
        self.tail: Optional[Node] = None   # least recently used

    def get(self, key: str) -> Optional[str]:
        node = self.index.get(key)
        if node is None:
            return None
        self._unlink(node)
        self._push_front(node)
        return node.value

    def put(self, key: str, value: str) -> None:
        node = self.index.get(key)
        if node is not None:
            node.value = value
            self._unlink(node)
            self._push_front(node)
            return
        if len(self.index) == self.capacity:
            lru = self.tail
            self._unlink(lru)
            del self.index[lru.key]
        node = Node(key, value)
        self.index[key] = node
        self._push_front(node)

    def keys_by_recency(self) -> list[str]:
        """Most recent first. Handy in tests."""
        out, node = [], self.head
        while node is not None:
            out.append(node.key)
            node = node.next
        return out

    def _unlink(self, node: Node) -> None:
        if node.prev is not None:
            node.prev.next = node.next
        else:
            self.head = node.next
        if node.next is not None:
            node.next.prev = node.prev
        else:
            self.tail = node.prev
        node.prev = node.next = None

    def _push_front(self, node: Node) -> None:
        node.next = self.head
        if self.head is not None:
            self.head.prev = node
        self.head = node
        if self.tail is None:
            self.tail = node
