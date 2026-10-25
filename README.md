# AIdeator Argument Advisor

Two pieces, in one repository:

1. **`web/`** — the full interactive demo (React + Express). Host this if you
   want the live Argument Advisor UI.
2. **`argument_advisor/`** — the Python function AIdeator can call from its own
   backend, using your own OpenAI key.

No API key is stored in this repository.

## Host the web demo yourselves

The public demo at `argumentadvisor.ishaangarg.com` currently serves the UI
without the Node API, so classify/coach calls fail. The reliable setup is to
run `web/` as one Node process that serves both the frontend and `/api`.

Required environment variable:

```text
OPENAI_API_KEY=your_key
```

Optional:

```text
OPENAI_MODEL=gpt-5-mini
PORT=8787
```

### Local production

```bash
cd web
npm ci
npm run build
OPENAI_API_KEY=your_key npm start
```

Open `http://localhost:8787`. Check `GET /api/health`. If `hasApiKey` is
`false`, the key is missing and coaching will fail.

### Docker

```bash
cd web
docker build -t argument-advisor .
docker run --rm -p 8787:8787 -e OPENAI_API_KEY=your_key argument-advisor
```

### Render / Railway / Fly

Point the service at the `web/` directory:

- **Build:** `npm ci && npm run build`
- **Start:** `npm start`
- **Env:** `NODE_ENV=production`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`

A Render blueprint is in [`render.yaml`](render.yaml).

---

## Python integration

A small Python package that lets AIdeator add an interactive Argument Advisor to
any entity in a nested GBS map.

The public `advise_argument()` function:

1. Finds the selected entity anywhere in the map.
2. Builds its complete root-to-target context using GBS `subtype` values.
3. Classifies the student's draft into one of five argument schemes.
4. Either returns one targeted question or returns map-aware coaching.
5. Preserves the Akinator-style top-two loop, capped at three diagnostic
   questions.

No API key is included in this repository. AIdeator supplies its own key via the
`api_key` argument or `OPENAI_API_KEY`.

## Install

```bash
python -m pip install \
  "git+https://github.com/ishaantek/aideator-argument-advisor.git"
```

For local development:

```bash
git clone https://github.com/ishaantek/aideator-argument-advisor.git
cd aideator-argument-advisor
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Minimal call

```python
import json
import os

from argument_advisor import advise_argument

with open("map.json", encoding="utf-8") as file:
    gbs_map = json.load(file)

result = advise_argument(
    argument=(
        "AMRs are good because nuclear is clean and then people will not have "
        "to care about gas prices anymore."
    ),
    map_root=gbs_map,
    target_id="E-1TV4KTN-1",
    stance="PRO",
    conversation=[],
    api_key=os.environ["OPENAI_API_KEY"],
)
```

The function is synchronous and returns a JSON-serializable dictionary.

## Handle the result

The function returns one of two states.

### It needs one answer

```json
{
  "status": "question",
  "question_kind": "diagnostic",
  "question": "Are you claiming AMRs directly stabilize prices, or mainly that they reduce dependence on imported gas?",
  "why_asking": "This separates the two reasoning patterns in your draft.",
  "answer_hints": ["They stabilize prices", "They reduce gas dependence"],
  "diagnostic_questions_asked": 1,
  "context_questions_asked": 0,
  "classification": {}
}
```

Show the question in AIdeator, append both the advisor question and the user's
answer to `conversation`, and call the function again using the returned
counters:

```python
conversation.extend(
    [
        {"role": "advisor", "content": result["question"]},
        {"role": "student", "content": user_answer},
    ]
)

result = advise_argument(
    argument=original_draft,
    map_root=gbs_map,
    target_id=target_id,
    stance=stance,
    conversation=conversation,
    diagnostic_questions_asked=result["diagnostic_questions_asked"],
    context_questions_asked=result["context_questions_asked"],
    api_key=your_key,
)
```

### Coaching is ready

```json
{
  "status": "coaching",
  "target_id": "E-1TV4KTN-1",
  "target_subtype": "SOLUTION",
  "stance": "PRO",
  "classification": {
    "scores": {},
    "top_two": ["CAUSE_EFFECT", "OPINION"],
    "confident": true,
    "margin": 0.42,
    "best_guess_of_intent": "...",
    "needs_context": false,
    "context_question": null
  },
  "coaching": {
    "scheme": "CAUSE_EFFECT",
    "scheme_plain_name": "a cause-and-effect argument",
    "what_youre_doing_well": "...",
    "the_gap": "...",
    "critical_questions_to_address": ["..."],
    "concrete_next_step": "...",
    "stronger_version": "..."
  }
}
```

AIdeator can render the coaching and, after the user revises or accepts the
draft, save its own PRO/CON child under `target_id`. The package never writes to
the map; persistence stays under AIdeator's control.

## Complete integration loop

See [`examples/aideator_loop.py`](examples/aideator_loop.py). It demonstrates:

- selecting any entity by ID;
- sending the complete ancestor path automatically;
- asking and answering dynamic questions;
- carrying counters and conversation state between requests;
- receiving final coaching.

For web backends that serve many requests, create one reusable client instead
of constructing it on each request:

```python
from argument_advisor import ArgumentAdvisor

advisor = ArgumentAdvisor(
    api_key=os.environ["OPENAI_API_KEY"],
    model="gpt-5-mini",
)

result = advisor.advise(
    argument=draft,
    map_root=gbs_map,
    target_id=target_id,
    stance="CON",
    conversation=conversation,
    diagnostic_questions_asked=diagnostic_count,
    context_questions_asked=context_count,
)
```

## GBS map expectations

The package expects the same recursive shape as the supplied EDF map:

```json
{
  "id": "root-id",
  "type": "IDEA",
  "subtype": "ROOT",
  "name": "Mission",
  "description": "...",
  "children": [
    {
      "id": "goal-id",
      "type": "IDEA",
      "subtype": "GOAL",
      "name": "A goal",
      "children": []
    }
  ]
}
```

Argument reasoning uses **`subtype`**, not the generic `type`. It supports any
subtype and any depth, including PROs and CONs attached to other PROs and CONs.

## Five schemes

- `AUTHORITY`: an expert or official source carries the inference
- `CAUSE_EFFECT`: one thing produces or prevents another
- `DATA`: an observation, statistic, or fact points to a conclusion
- `EXAMPLE`: a case, analogy, or precedent supports a broader claim
- `OPINION`: a value judgment or popular belief without a causal mechanism

## Reliability and failures

- Every model call requests JSON and validates its shape.
- Invalid or malformed model output is retried once.
- The Responses API is used first, with Chat Completions as a compatibility
  fallback.
- Student and map content are explicitly treated as untrusted data.
- The default model is `gpt-5-mini`; pass another model if needed.

In a 100-item internet-style evaluation of the same classification logic, the
true scheme appeared in the top two 99% of the time. That is why the interaction
asks a discriminating question when the top two are close instead of blindly
trusting the first label.

## Tests

```bash
pytest
ruff check .
```

The unit tests use a fake model client and do not require an API key.

To make one live call:

```bash
export OPENAI_API_KEY="..."
python examples/basic_usage.py
```
