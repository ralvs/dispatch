# Memex writes thoughts in English

Date: 2026-10-09

Memex is the knowledge engine planned inside Dispatch (map #117). It reads
Renan's notes and tasks and compiles them into **thoughts**: short,
one-fact statements that Memex writes and owns (#120). Renan writes in
PT-BR and in English, often in the same day.

Search across languages is weak today. A note saved in PT-BR is hard to find
with an English query, for a person and for an agent: Postgres full-text
search stems one language at a time, and the same fact has two spellings.
Echo, the app Memex replaces, already translates every thought to English,
and its English-only search works on that text.

Iron rule #5 says content is stored verbatim in the language written and is
never translated. Read on its own, a translated thought looks like a break of
that rule. This ADR says why it is not.

## Decision

1. **A thought's text is always English**, whatever the language of its
   sources. A PT-BR note about "limpeza do ar-condicionado" gives the thought
   "Main bedroom AC cleaned in April 2026, R$ 150".
2. **Names and amounts stay as written.** People, places and things keep
   their own names ("Andrea", "Rua Augusta"). Money keeps its currency
   ("R$ 150", never converted).
3. **Renan's content is unchanged.** Notes and tasks stay verbatim, in the
   language written. Memex never edits them (map #117). The language of a
   note or task that Memex *proposes* is left to the ticket that designs
   proposals.
4. **Every thought links to its sources**, so the original words are always
   one step away (#120).

## Why rule #5 still holds

Rule #5 protects what the owner writes. A thought is not the owner's text:
Memex writes it, as a summary of the owner's text. Translating a summary does
not change a word the owner wrote. The rule stays as it is, and a thought is
outside its scope.

## Consequences

- Thought search can use one language: English full-text search plus
  embeddings. Bilingual search over notes is still a separate problem.
- A thought from a PT-BR answer ("paguei 3.500") reads differently from the
  answer. The source link keeps the original.
- Translation can lose a nuance. A thought is one fact (#120), so the loss is
  small, and the source is the record of truth.
- Reverting means rewriting each thought from its sources in their own
  language. Memex can do that from the source links.
