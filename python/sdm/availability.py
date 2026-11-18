def serial(*availabilities: float) -> float:
    """A request that needs every component works only if all of them are up."""
    result = 1.0
    for a in availabilities:
        result *= a
    return result


def redundant(a: float, copies: int) -> float:
    """With independent copies, the service is down only if every copy is down at once."""
    return 1 - (1 - a) ** copies


def downtime_minutes_per_month(a: float, days: int = 30) -> float:
    return (1 - a) * days * 24 * 60
