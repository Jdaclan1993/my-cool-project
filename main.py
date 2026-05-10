import sys
from hello import Hello


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "world"
    Hello().greet(name)


if __name__ == "__main__":
    main()
