"""Example state loop for an AIdeator backend or controller."""

from __future__ import annotations

import json
from pathlib import Path

from argument_advisor import ArgumentAdvisor

MAP_PATH = Path(__file__).with_name("example_map.json")


def run_advisor_loop() -> None:
    with MAP_PATH.open(encoding="utf-8") as file:
        gbs_map = json.load(file)

    advisor = ArgumentAdvisor()  # Reads OPENAI_API_KEY from the environment.
    draft = input("Draft a PRO argument for the AMR solution:\n> ").strip()
    conversation: list[dict[str, str]] = []
    diagnostic_count = 0
    context_count = 0

    while True:
        result = advisor.advise(
            argument=draft,
            map_root=gbs_map,
            target_id="amr-solution",
            stance="PRO",
            conversation=conversation,
            diagnostic_questions_asked=diagnostic_count,
            context_questions_asked=context_count,
        )

        diagnostic_count = result["diagnostic_questions_asked"]
        context_count = result["context_questions_asked"]

        if result["status"] == "question":
            print(f"\nAdvisor: {result['question']}")
            answer = input("> ").strip()
            conversation.extend(
                [
                    {"role": "advisor", "content": result["question"]},
                    {"role": "student", "content": answer},
                ]
            )
            continue

        print("\nFinal coaching:")
        print(json.dumps(result["coaching"], indent=2))
        break


if __name__ == "__main__":
    run_advisor_loop()
