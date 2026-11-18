from sdm.read_routing import pick_database


def test_writer_reads_leader_right_after_writing():
    assert pick_database("alex", "alex", last_write_at=100.0, now=100.5) == "leader"


def test_writer_returns_to_follower_after_window():
    assert pick_database("alex", "alex", last_write_at=100.0, now=106.0) == "follower"


def test_other_readers_always_use_follower():
    assert pick_database("sister", "alex", last_write_at=100.0, now=100.5) == "follower"
