from snapbet_pipeline.prop_shop import _name, find_flags


def _row(book, over, under, line=24.5, player="Jalen Brunson", market="player_points"):
    return {"bookmaker": book, "market": market, "player_name": player, "line": line,
            "over_price": over, "under_price": under}


def test_flags_the_one_book_that_beats_the_others_fair_price():
    rows = [_row("a", 1.91, 1.91), _row("b", 1.91, 1.91), _row("c", 1.91, 1.91), _row("d", 2.10, 1.75)]
    [f] = find_flags(rows)
    assert (f["bookmaker"], f["side"], f["price"], f["n_books"]) == ("d", "over", 2.10, 3)
    assert f["fair_prob"] == 0.5 and f["edge"] == 0.05


def test_no_flag_without_enough_other_books_or_at_other_lines_or_absurd_gaps():
    assert find_flags([_row("a", 1.91, 1.91), _row("b", 1.91, 1.91), _row("d", 2.10, 1.75)]) == []
    rows = [_row("a", 1.91, 1.91), _row("b", 1.91, 1.91), _row("c", 1.91, 1.91)]
    assert find_flags(rows + [_row("d", 2.10, 1.75, line=25.5)]) == []      # different line: not comparable
    assert find_flags(rows + [_row("d", 3.50, 1.30)]) == []                 # +75%: wrong line, not value


def test_one_sided_book_can_be_flagged_but_never_sets_the_fair_price():
    rows = [_row("a", 1.80, 2.00), _row("b", 1.80, 2.00), _row("c", 1.80, 2.00), _row("d", 2.05, None)]
    [f] = find_flags(rows)
    assert f["bookmaker"] == "d" and f["n_books"] == 3


def test_name_matching_ignores_accents_suffixes_and_punctuation():
    assert _name("Nikola Jokić") == _name("Nikola Jokic")
    assert _name("Jaren Jackson Jr.") == _name("Jaren Jackson") and _name("P.J. Washington") == _name("PJ Washington")
