"""Make one live Argument Advisor call."""

from __future__ import annotations

import json
from pathlib import Path

from argument_advisor import advise_argument

MAP_PATH = Path(__file__).with_name("example_map.json")


def main() -> None:
    with MAP_PATH.open(encoding="utf-8") as file:
        gbs_map = json.load(file)

    result = advise_argument(
        argument=(
            "AMRs are good because nuclear is clean and then people will not "
            "have to care about gas prices anymore."
        ),
        map_root=gbs_map,
        target_id="amr-solution",
        stance="PRO",
        conversation=[],
        # OPENAI_API_KEY is read from the environment.
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
