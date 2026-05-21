from hello import Hello


def test_greet_default(capsys):
    Hello().greet()
    captured = capsys.readouterr()
    assert "Hello world" in captured.out


def test_greet_named(capsys):
    Hello().greet("julius")
    captured = capsys.readouterr()
    assert "Hello julius" in captured.out
