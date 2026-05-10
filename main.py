import sys
from hello import Hello


def main(name: str = "world") -> None:
    Hello().greet(name)


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "world"
    main(name)
