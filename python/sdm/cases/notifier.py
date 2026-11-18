from typing import Callable

Channel = Callable[[str, str], None]      # (user, message) -> None; raises on failure


class Notifier:
    """Sends through each preferred channel; one failing channel doesn't block the others."""

    def __init__(self, channels: dict[str, Channel], prefs: dict[str, list[str]]):
        self.channels = channels
        self.prefs = prefs
        self.sent: set[tuple[str, str, str]] = set()     # (notification_id, user, channel)

    def notify(self, notification_id: str, user: str, message: str) -> dict[str, str]:
        result = {}
        for name in self.prefs.get(user, []):
            key = (notification_id, user, name)
            if key in self.sent:
                result[name] = "duplicate skipped"
                continue
            try:
                self.channels[name](user, message)
                self.sent.add(key)
                result[name] = "sent"
            except Exception as exc:
                result[name] = f"failed: {exc}"
        return result
