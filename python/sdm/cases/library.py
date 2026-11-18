from dataclasses import dataclass, field


@dataclass
class Copy:
    copy_id: str
    isbn: str
    borrower: str | None = None


@dataclass
class Member:
    member_id: str
    loans: set[str] = field(default_factory=set)
    max_loans: int = 3


class Library:
    def __init__(self):
        self.copies: dict[str, Copy] = {}
        self.members: dict[str, Member] = {}

    def borrow(self, member_id: str, isbn: str) -> str:
        member = self.members[member_id]
        if len(member.loans) >= member.max_loans:
            raise ValueError("loan limit reached")
        copy = next((c for c in self.copies.values() if c.isbn == isbn and c.borrower is None), None)
        if copy is None:
            raise LookupError("no copy available")
        copy.borrower = member_id
        member.loans.add(copy.copy_id)
        return copy.copy_id

    def give_back(self, copy_id: str) -> None:
        copy = self.copies[copy_id]
        self.members[copy.borrower].loans.discard(copy_id)
        copy.borrower = None
