STICKY_SECONDS = 5


def pick_database(reader_id: str, owner_id: str, last_write_at: float, now: float) -> str:
    """Send a user's reads of their own profile to the leader for a few seconds after they write."""
    if reader_id == owner_id and now - last_write_at < STICKY_SECONDS:
        return "leader"
    return "follower"
