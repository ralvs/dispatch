# The parser takes its model; tests fake the model, not the module

Date: 2026-10-04

The parser called `parserModel()` itself, so the only way to test it without
a paid call was to replace modules: `vi.mock("ai")` swapped out
`generateObject`, and `vi.mock("@/lib/ai/gateway")` swapped out the model and
the configured check. Those tests asserted on the arguments handed to a fake
`generateObject`, never on what a model would receive. Schema validation,
retries, the abort signal and usage reporting were the SDK's, so they were not
tested at all. A test for an unknown verb had to reject with a made-up error.

The sentence-to-task parse (`parseTaskCapture`) lived in quick-add with its
own copy of the call, and the eval rebuilt both calls a third time from
exported prompt pieces.

## Decision

1. **The model is a parameter.** The port is the SDK's own type:
   `ParserModel = Exclude<LanguageModel, string>`. The gateway adapter is
   `parserModel()` in `lib/ai/gateway.ts`, unchanged. The fake is
   `MockLanguageModelV4` from `ai/test`, wrapped in
   `test/fakes/parser-model.ts`. The real `generateObject` runs against it.
2. **`model` left out and `model: null` mean different things.** `parse` and
   `parseTask` take an optional last argument, `{ model?: ParserModel | null }`.
   Left out, the app gets the gateway's model when AI is configured, and
   `unavailable` when it is not. `null` is always `unavailable`, never a
   gateway call. The model is resolved inside the `try`, because `env()` can
   throw.
3. **`parse*` for the app, `request*` for the eval.** `parse` (palette) and
   `parseTask` (quick-add) keep the typed fallbacks and the title guard (iron
   rule #4). `requestActions` and `requestTask` are the same request, raw: no
   guard, they throw, and they return the call's `usage`. The eval calls them,
   so it scores the request the app sends. For `--effort` the eval wraps the
   model with `wrapLanguageModel`; effort is not part of the parser's
   interface.
4. **`lib/ai/parser.ts` owns both prompts.** `parseTask` and its prompt move in
   from quick-add. The prompt pieces, `cachedSystem`, `captureUserMessage`,
   the call options and the failure log are no longer exported.
5. **No test module-mocks `ai` or the gateway.** Unit runs drop
   `AI_GATEWAY_API_KEY` (`test/unit/setup.ts`), as integration runs already
   did, so a test that forgets to inject a model gets `unavailable`, not a
   paid call. Tests of code that only calls `parse` (`capture()`, the capture
   route) may still mock `@/lib/ai/parser`.

The prompt text is unchanged (ADR-0061). `lib/ai/__golden__/` pins both system
prompts and the user message byte for byte. The files were written before the
refactor, and the test now reads the text from the fake model's recorded
request.

## Consequences

- A parser test asserts on what the model received (`sentSystem`, `sentUser`,
  `sentOptions`), so a change to the call options or the message shape shows
  up in the test.
- A prompt edit changes a golden file. That diff is the change under review,
  and it still needs the eval (ADR-0061).
- `capture()` and its tests still mock `parse`. Moving them onto the fake is a
  separate change.
