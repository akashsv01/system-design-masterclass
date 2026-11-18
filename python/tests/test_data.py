from sdm.index import full_scan, index_lookup
from sdm.lsm import TinyLSM
from sdm.partitioning import Ring, modulo_shard, moved_fraction, stable_hash

KEYS = [f"user-{i}" for i in range(5000)]


def test_stable_hash_is_stable():
    assert stable_hash("F12") == stable_hash("F12")


def test_modulo_moves_most_keys_when_adding_a_shard():
    frac = moved_fraction(KEYS, lambda k: modulo_shard(k, 4), lambda k: modulo_shard(k, 5))
    assert 0.75 < frac < 0.85          # about 4/5 of keys move


def test_ring_moves_about_one_fifth():
    before, after = Ring(["a", "b", "c", "d"]), Ring(["a", "b", "c", "d", "e"])
    frac = moved_fraction(KEYS, before.owner, after.owner)
    assert 0.12 < frac < 0.30          # ideally 1/5; virtual nodes keep it close
    assert all(after.owner(k) == "e" for k in KEYS if before.owner(k) != after.owner(k))


def test_lsm_reads_newest_value_and_compacts():
    db = TinyLSM(memtable_limit=2)
    db.put("F12", "free")
    db.put("F13", "free")              # flush 1
    db.put("F12", "held")
    db.put("F14", "free")              # flush 2
    assert db.get("F12") == "held"
    assert len(db.sstables) == 2
    db.compact()
    assert len(db.sstables) == 1 and db.get("F12") == "held"


def test_index_takes_log_steps():
    rows = [{"email": f"u{i:06d}@x.test", "id": i} for i in range(100_000)]
    by_email = {r["email"]: r for r in rows}
    emails = sorted(by_email)
    target = "u099999@x.test"
    _, scanned = full_scan(rows, target)
    row, steps = index_lookup(emails, by_email, target)
    assert row["id"] == 99_999 and scanned == 100_000 and steps <= 17
