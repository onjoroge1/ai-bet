from types import SimpleNamespace as NS

from snapbet_pipeline.ai_research import FORECAST_TOOL, _forecast
from snapbet_pipeline.injuries import parse_injuries


def _usage(i=1000, o=200, searches=0):
    return NS(input_tokens=i, output_tokens=o, cache_read_input_tokens=0,
              server_tool_use=NS(web_search_requests=searches))


class _Messages:
    def __init__(self, responses):
        self.responses, self.calls = list(responses), []

    def create(self, **kw):
        self.calls.append(kw)
        return self.responses.pop(0)


def _client(responses):
    m = _Messages(responses)
    return NS(beta=NS(messages=m)), m


def test_forecast_resumes_pause_turn_then_reads_tool_input():
    paused = NS(content=[NS(type="server_tool_use", name="web_search")], stop_reason="pause_turn",
                usage=_usage(searches=2), model="claude-opus-5-5")
    done = NS(content=[NS(type="text", text="..."),
                       NS(type="tool_use", name="submit_forecast",
                          input={"prob_home": 0.41, "confidence": "low", "key_factors": [],
                                 "news_found": "none", "reasoning": "r"})],
              stop_reason="tool_use", usage=_usage(500, 300, 1), model="claude-opus-5-5")
    client, m = _client([paused, done])
    r = _forecast(client, {"home_team": "H"}, "claude-opus-5-5")
    assert r["forecast"]["prob_home"] == 0.41
    assert r["usage"] == {"input_tokens": 1500, "output_tokens": 500, "web_searches": 3}
    assert len(m.calls) == 2 and m.calls[1]["messages"][1]["role"] == "assistant"
    first = m.calls[0]
    assert first["model"] == "claude-opus-5-5" and first["fallbacks"] == "default"
    assert "thinking" not in first and "temperature" not in first
    assert any(t.get("type") == "web_search_20260209" for t in first["tools"]) and FORECAST_TOOL in first["tools"]


def test_forecast_gives_up_after_refusal():
    refused = NS(content=[], stop_reason="refusal", stop_details=None, usage=_usage(), model="m")
    client, _ = _client([refused])
    assert "forecast" not in _forecast(client, {}, "m")


def test_parse_injuries_reads_athlete_id_from_links():
    data = {"injuries": [{"displayName": "Atlanta Hawks", "injuries": [{
        "id": "538982", "status": "Day-To-Day", "date": "2026-11-14T03:20Z", "shortComment": "back",
        "athlete": {"displayName": "Kingston Flemings", "position": {"abbreviation": "G"},
                    "links": [{"href": "https://www.espn.com/nba/player/_/id/5149077/kingston-flemings"}]},
        "details": {"type": "Back", "returnDate": "2026-11-15", "fantasyStatus": {"abbreviation": "GTD"}}}]}]}
    [r] = parse_injuries(data, "basketball_nba")
    assert r["player_id"] == "5149077" and r["team"] == "Atlanta Hawks" and r["fantasy_status"] == "GTD"
    assert r["return_date"] == "2026-11-15" and r["espn_injury_id"] == "538982"
