import bisect


def full_scan(rows: list[dict], email: str) -> tuple[dict | None, int]:
    """Check every row. Returns the row and how many rows were examined."""
    for i, row in enumerate(rows):
        if row["email"] == email:
            return row, i + 1
    return None, len(rows)


def index_lookup(sorted_emails: list[str], rows_by_email: dict, email: str) -> tuple[dict | None, int]:
    """Binary search a sorted index: each step halves what is left. Returns the row and steps taken."""
    lo, hi, steps = 0, len(sorted_emails), 0
    while lo < hi:
        steps += 1
        mid = (lo + hi) // 2
        if sorted_emails[mid] < email:
            lo = mid + 1
        else:
            hi = mid
    found = lo < len(sorted_emails) and sorted_emails[lo] == email
    return (rows_by_email[email] if found else None), steps
