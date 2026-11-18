class TinyLSM:
    """The write path of a log-structured merge tree, without the files."""

    def __init__(self, memtable_limit: int = 3):
        self.wal: list[tuple[str, str]] = []     # append-only log, survives a crash
        self.memtable: dict[str, str] = {}       # recent writes, in memory
        self.sstables: list[dict[str, str]] = [] # sorted, immutable runs on disk (newest last)
        self.limit = memtable_limit

    def put(self, key: str, value: str) -> None:
        self.wal.append((key, value))            # 1. make it durable
        self.memtable[key] = value               # 2. make it readable
        if len(self.memtable) >= self.limit:
            self.sstables.append(dict(sorted(self.memtable.items())))  # 3. flush a sorted run
            self.memtable, self.wal = {}, []

    def get(self, key: str):
        if key in self.memtable:
            return self.memtable[key]
        for table in reversed(self.sstables):    # newest first: newer values win
            if key in table:
                return table[key]
        return None

    def compact(self) -> None:
        merged: dict[str, str] = {}
        for table in self.sstables:              # older first, so newer overwrite
            merged.update(table)
        self.sstables = [dict(sorted(merged.items()))]
