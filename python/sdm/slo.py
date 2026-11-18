def error_budget(slo: float, total_requests: int) -> int:
    """How many requests may fail in the period while still meeting the SLO."""
    return round((1 - slo) * total_requests)


def budget_remaining(slo: float, total_requests: int, failed: int) -> float:
    budget = error_budget(slo, total_requests)
    return 1 - failed / budget if budget else 0.0


def burn_rate(slo: float, error_ratio_now: float) -> float:
    """1.0 means spending the budget exactly over the period; 10 means ten times too fast."""
    return error_ratio_now / (1 - slo)
