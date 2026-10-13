from __future__ import annotations

import copy
from typing import Any

import pytest

from argument_advisor import ArgumentAdvisor, advise_argument, find_node_path

MAP = {
    "type": "IDEA",
    "subtype": "ROOT",
    "name": "Energy mission",
    "description": "Keep energy affordable and reliable.",
    "id": "root",
    "children": [
        {
            "type": "IDEA",
            "subtype": "GOAL",
            "name": "Stable prices",
            "description": "Protect households from price shocks.",
            "id": "goal",
            "children": [
                {
                    "type": "IDEA",
                    "subtype": "SOLUTION",
                    "name": "Build AMRs",
                    "description": "Reduce dependence on volatile gas.",
                    "id": "solution",
                    "children": [
                        {
                            "type": "ARGUMENT",
                            "subtype": "CON",
                            "name": "High capital costs",
                            "description": "AMRs may cost too much initially.",
                            "id": "existing-con",
                        }
                    ],
                }
            ],
        }
    ],
}


def classification(
    *, confident: bool = True, needs_context: bool = False
) -> dict[str, Any]:
    return {
        "scores": {
            "AUTHORITY": 0.02,
            "CAUSE_EFFECT": 0.7,
            "DATA": 0.08,
            "EXAMPLE": 0.05,
            "OPINION": 0.15,
        },
        "top_two": ["CAUSE_EFFECT", "OPINION"],
        "confident": confident,
        "margin": 0.55 if confident else 0.08,
        "best_guess_of_intent": "A PRO for Build AMRs based on price stability.",
        "needs_context": needs_context,
        "context_question": (
            "What price risk do you expect AMRs to reduce?"
            if needs_context
            else None
        ),
    }


COACHING = {
    "scheme": "CAUSE_EFFECT",
    "scheme_plain_name": "a cause-and-effect argument",
    "what_youre_doing_well": "You connect gas dependence to price volatility.",
    "the_gap": "You do not explain how AMRs change household prices.",
    "critical_questions_to_address": [
        "Would AMR construction costs offset the fuel-price stability?"
    ],
    "concrete_next_step": "Add the missing mechanism and timeframe.",
    "stronger_version": None,
}


class StubAdvisor(ArgumentAdvisor):
    def __init__(self, responses: list[dict[str, Any]]) -> None:
        super().__init__(client=object())
        self.responses = responses
        self.prompts: list[str] = []

    def _call_json(
        self, prompt: str, validator: Any, *, max_tokens: int
    ) -> dict[str, Any]:
        self.prompts.append(prompt)
        response = self.responses.pop(0)
        assert validator(response)
        return response


def test_find_node_path_handles_any_depth() -> None:
    path = find_node_path(MAP, "existing-con")
    assert [node["id"] for node in path] == [
        "root",
        "goal",
        "solution",
        "existing-con",
    ]


def test_coaching_uses_full_connected_context_and_subtypes() -> None:
    advisor = StubAdvisor([classification(), COACHING])
    result = advisor.advise(
        argument="AMRs make bills stable because gas prices stop mattering.",
        map_root=MAP,
        target_id="solution",
        stance="PRO",
    )

    assert result["status"] == "coaching"
    assert result["target_subtype"] == "SOLUTION"
    assert result["coaching"]["scheme"] == "CAUSE_EFFECT"
    combined_prompts = "\n".join(advisor.prompts)
    assert "[ROOT] Energy mission" in combined_prompts
    assert "[GOAL] Stable prices" in combined_prompts
    assert "[SOLUTION] Build AMRs" in combined_prompts
    assert "CON: AMRs may cost too much initially." in combined_prompts


def test_uncertain_classification_returns_one_diagnostic_question() -> None:
    diagnostic = {
        "question": "Are you describing a mechanism or mainly saying AMRs are good?",
        "why_asking": "This tells me which reasoning pattern carries your claim.",
        "answer_hints": ["A mechanism", "Mainly a value judgment"],
    }
    advisor = StubAdvisor(
        [classification(confident=False), copy.deepcopy(diagnostic)]
    )
    result = advisor.advise(
        argument="AMRs are good and prices will be better.",
        map_root=MAP,
        target_id="solution",
        stance="PRO",
    )

    assert result["status"] == "question"
    assert result["question_kind"] == "diagnostic"
    assert result["question"] == diagnostic["question"]
    assert result["diagnostic_questions_asked"] == 1


def test_context_question_is_returned_before_diagnostic() -> None:
    advisor = StubAdvisor([classification(confident=False, needs_context=True)])
    result = advisor.advise(
        argument="It will help.",
        map_root=MAP,
        target_id="solution",
        stance="PRO",
    )

    assert result["status"] == "question"
    assert result["question_kind"] == "context"
    assert result["context_questions_asked"] == 1
    assert not advisor.responses


def test_question_cap_proceeds_with_best_guess() -> None:
    advisor = StubAdvisor([classification(confident=False), COACHING])
    result = advisor.advise(
        argument="AMRs are good and prices will be better.",
        map_root=MAP,
        target_id="solution",
        stance="PRO",
        diagnostic_questions_asked=3,
    )
    assert result["status"] == "coaching"


def test_con_stance_and_argument_targets_are_supported() -> None:
    advisor = StubAdvisor([classification(), COACHING])
    result = advisor.advise(
        argument="That cost objection ignores long-term fuel savings.",
        map_root=MAP,
        target_id="existing-con",
        stance="CON",
    )
    assert result["stance"] == "CON"
    assert result["target_subtype"] == "CON"
    assert "STANCE: CON" in advisor.prompts[0]


def test_convenience_function_accepts_injected_client() -> None:
    class FakeResponses:
        def __init__(self) -> None:
            self.values = [classification(), COACHING]

        def create(self, **_: Any) -> Any:
            value = self.values.pop(0)
            output_text = __import__("json").dumps(value)
            return type("Response", (), {"output_text": output_text})()

    fake_client = type("Client", (), {"responses": FakeResponses()})()
    result = advise_argument(
        argument="AMRs reduce gas exposure, which should stabilize household bills.",
        map_root=MAP,
        target_id="solution",
        stance="PRO",
        client=fake_client,
    )
    assert result["status"] == "coaching"


@pytest.mark.parametrize("stance", ["YES", "", "support"])
def test_invalid_stance_is_rejected(stance: str) -> None:
    advisor = StubAdvisor([])
    with pytest.raises(ValueError, match="stance"):
        advisor.advise(
            argument="A draft",
            map_root=MAP,
            target_id="solution",
            stance=stance,  # type: ignore[arg-type]
        )


def test_missing_target_is_rejected() -> None:
    advisor = StubAdvisor([])
    with pytest.raises(ValueError, match="not found"):
        advisor.advise(
            argument="A draft",
            map_root=MAP,
            target_id="missing",
            stance="PRO",
        )
