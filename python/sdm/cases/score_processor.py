from dataclasses import dataclass, field


@dataclass
class MatchState:
    home: int = 0
    away: int = 0
    goals: dict[str, str] = field(default_factory=dict)    # goal_id -> team
    last_seq: int = 0


class ScoreProcessor:
    """Applies provider events once, in sequence order, and treats corrections as events."""

    def __init__(self):
        self.state = MatchState()
        self.seen: set[str] = set()
        self.pending: dict[int, dict] = {}

    def receive(self, event: dict) -> list[int]:
        """Returns the sequence numbers applied by this call (possibly several, once a gap fills)."""
        if event["id"] in self.seen:
            return []                                        # duplicate from the provider
        self.seen.add(event["id"])
        self.pending[event["seq"]] = event
        applied = []
        while self.state.last_seq + 1 in self.pending:       # apply strictly in order
            ev = self.pending.pop(self.state.last_seq + 1)
            self._apply(ev)
            self.state.last_seq = ev["seq"]
            applied.append(ev["seq"])
        return applied

    def _apply(self, ev: dict) -> None:
        if ev["type"] == "goal":
            self.state.goals[ev["goal_id"]] = ev["team"]
        elif ev["type"] == "goal_disallowed":
            self.state.goals.pop(ev["goal_id"], None)
        teams = list(self.state.goals.values())
        self.state.home, self.state.away = teams.count("home"), teams.count("away")
