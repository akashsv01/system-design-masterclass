class Board:
    """A grid game where `win_length` in a row wins: 3 on 3×3 is tic-tac-toe, 4 on 6×7 is Connect Four."""

    def __init__(self, rows: int, cols: int, win_length: int, gravity: bool):
        self.rows, self.cols, self.win_length, self.gravity = rows, cols, win_length, gravity
        self.cells: list[list[str | None]] = [[None] * cols for _ in range(rows)]

    def place(self, player: str, col: int, row: int | None = None) -> tuple[int, int]:
        if self.gravity:                                  # Connect Four: falls to the lowest free row
            row = next((r for r in range(self.rows - 1, -1, -1) if self.cells[r][col] is None), None)
            if row is None:
                raise ValueError("column full")
        elif row is None or self.cells[row][col] is not None:
            raise ValueError("cell taken")
        self.cells[row][col] = player
        return row, col

    def wins(self, row: int, col: int) -> bool:
        player = self.cells[row][col]
        for dr, dc in [(0, 1), (1, 0), (1, 1), (1, -1)]:
            count = 1
            for sign in (1, -1):
                r, c = row + dr * sign, col + dc * sign
                while 0 <= r < self.rows and 0 <= c < self.cols and self.cells[r][c] == player:
                    count += 1
                    r, c = r + dr * sign, c + dc * sign
            if count >= self.win_length:
                return True
        return False


def tic_tac_toe() -> Board:
    return Board(3, 3, 3, gravity=False)


def connect_four() -> Board:
    return Board(6, 7, 4, gravity=True)
