from collections import defaultdict


def balances(expenses: list[tuple[str, int, list[str]]]) -> dict[str, int]:
    """Each expense: (payer, amount_cents, people sharing it). Positive balance = is owed money."""
    bal: dict[str, int] = defaultdict(int)
    for payer, amount, people in expenses:
        share, remainder = divmod(amount, len(people))
        for i, person in enumerate(people):
            bal[person] -= share + (1 if i < remainder else 0)   # spread leftover cents
        bal[payer] += amount
    return dict(bal)


def settle(bal: dict[str, int]) -> list[tuple[str, str, int]]:
    """Greedy: largest debtor pays largest creditor until everyone is at zero."""
    debtors = sorted([(b, p) for p, b in bal.items() if b < 0])
    creditors = sorted([(b, p) for p, b in bal.items() if b > 0], reverse=True)
    payments, i, j = [], 0, 0
    while i < len(debtors) and j < len(creditors):
        owe, d = debtors[i]
        due, c = creditors[j]
        amount = min(-owe, due)
        payments.append((d, c, amount))
        debtors[i] = (owe + amount, d)
        creditors[j] = (due - amount, c)
        if debtors[i][0] == 0:
            i += 1
        if creditors[j][0] == 0:
            j += 1
    return payments
