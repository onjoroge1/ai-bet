from snapbet_pipeline.prop_results import outcome


def test_outcome_over_under_push():
    assert outcome(25, 24.5) == "over" and outcome(24, 24.5) == "under" and outcome(3, 3.0) == "push"
