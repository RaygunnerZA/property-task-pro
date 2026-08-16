# AI capability golden sets

Fixtures used to compare a candidate `(model, prompt_version)` against the
incumbent before it becomes primary. See `@Docs/07_AI_Intelligence.md` and
`@Docs/21` for the lifecycle and retention rules.

## What these are for

Production-derived metrics (`admin_ai_plan_extraction_metrics`) tell you what
real reviewers corrected. They are representative but never comparable across
time, because the inputs change. These fixtures are the opposite: a fixed input
set, so two models can be scored against the same thing.

Use both. Neither alone justifies a promotion.

## Source material rules — read before adding a fixture

Every fixture must be **either**:

1. **Synthetic** — drawn or written for this purpose, describing no real
   property, **or**
2. **Explicitly consented** — the customer agreed, in writing, that this
   specific document may be used for Filla platform evaluation.

Community data-sharing consent does **not** cover this. Replaying a customer's
drawing to candidate providers on every eval run is platform R&D, not delivery
of the service they bought.

Additional constraints:

- Fixtures live here, in the repository — never in an org storage bucket, and
  never inside `property-plans` or `property-plan-pages`.
- Fixtures are excluded from org deletion flows because they are not org data.
  A consented fixture must be removed from this directory if consent is
  withdrawn; add a line to the manifest `notes` recording the basis.
- No personal data: no names, signatures, addresses, or contact details, even
  in synthetic material.

## Manifest shape

```json
{
  "fixture_set": "task_extraction_synthetic_v1",
  "capability": "task_extraction",
  "notes": "Fully synthetic. No real property or person.",
  "fixtures": [
    {
      "id": "t-leak",
      "input": { "text": "urgent leak under the bathroom sink" },
      "expected": ["priority:urgent", "space:bathroom"]
    }
  ]
}
```

`expected` is a set of `field:value` claims, normalised case-insensitively.
Scoring measures recall of those claims and the false-positive rate of claims
the model added that no fixture asked for. A model is not penalised for
returning extra unrelated fields, only extra claims in the scored namespaces.

## Adding plan fixtures

`plan_label_extraction.json` ships empty on purpose: it needs images, and no
synthetic floorplan is committed yet. To add one, place the image under
`evals/fixtures/plans/` and reference it with `input.image`. Keep it legible at
the resolution the pipeline actually sends.

## Running

```bash
npm run eval:ai                       # scoring self-check, no provider calls
RUN_AI_EVALS=1 npm run eval:ai        # calls providers, needs API keys
```
