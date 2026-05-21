from datetime import datetime


class Hello:
    __slots__ = ()

    def greet(self, name: str = "world") -> None:
        now = datetime.now().strftime("%H:%M:%S")
        print(f"Hello {name} — {now}")


if __name__ == "__main__":
    Hello().greet()
