# Traduzco — Vocabulary Roguelike (v0 Design)

**Date:** 2026-06-12
**Status:** Approved design, pre-implementation
**Domain:** traduz.co

## Vision

A genuinely *game-first* Spanish learning experience for **B2–C1+ learners** — the
underserved advanced end of the market, where almost every existing tool (Duolingo,
flashcard apps) stays frustratingly basic. The north star: something you'd open at 9pm
*instead of* Steam, that happens to make vocabulary, listening, and conversational
grammar stick.

The core bet, and the thing no existing app has, is the combination of:

1. **The player's own curated vocabulary** — words and phrases personally collected
   (e.g. from years of tutoring notebooks), the exact words *they* tripped on, in *their*
   life. High-signal, private, personal data.
2. **A game shell** — a roguelike deckbuilder in the spirit of *Slay the Spire*.
3. **An LLM/content engine** — capable of generating effectively infinite adaptive
   content from that personal seed.

This document scopes **v0.0.0**: a thin vertical slice whose *only* job is to prove the
core gameplay loop is fun and addicting. If the loop is fun, the larger vision is
justified. If it isn't, we've spent days finding out, not years.

## Design Pillars (the constraints that shape everything)

These emerged during brainstorming and are load-bearing:

- **Game-first, not edutainment.** It must feel as much a *game* as it does learning.
  The user falls off non-game study tools but reliably plays video games.
- **No typing as the primary interface.** Disliked. (Voice and tap are the futures.)
- **No translation / no L1→L2 routing.** Connect language directly to
  *intention, feeling, action, image* — never image→English→Spanish. Bonus: a
  translation-free, image-driven game needs **no localization** — it works identically
  for a Korean or Brazilian learner of Spanish.
- **Association as the memory mechanism.** Visual/audible associations create the
  connective tissue that makes vocabulary sticky (the classic "*caber* = people fitting
  into a *cab*"). In this game, **the card art *is* the mnemonic.**
- **Dream big, aim close.** The full vision is years of work (art, animation, playtesting).
  v0 is a small, pro-loop-or-disprove-loop POC that scales down to a phone for a quick
  battle or two.

## Architecture: Three Layers

Everything stacks into three reusable layers. Each is independently valuable and reusable
across future games/modes.

### 1. Content layer — the Deck system
The atomic unit is a **card**: a word/phrase + its association media + mastery state.
This is the spine of everything — the cards, the SRS units, and (later) the shareable
social objects. It's filled by the (future) ingestion pipeline and edited by the
(future) deck editor.

### 2. Challenge layer — pluggable interaction modes
**Key architectural decision: decouple the card from how it is tested.** A card defines a
target meaning. *How* the player proves they know it is a swappable interface that returns
pass/fail (+ score). This lets multiple modalities coexist as siblings:

- 🤫 **Quiet / tap** — bus-and-shy-friendly, no microphone (v0 ships this)
- 🎙️ **Voice** — say it aloud; trains pronunciation; the true long-term differentiator (later)

Voice and quiet are **not two games** — they're two implementations of one interface.

### 3. Game layer — the roguelike
Consumes challenges as the "casting cost," wraps them in combat, juice, and progression.
This is where *new games/modes* plug in later (a Magic-style constructed mode, a rhythm
mode, etc.), all riding the same two layers beneath.

## v0.0.0 Scope — the Vertical Slice

A thin slice through **all three layers**, game-forward. The deck primitive gets built
because the game needs it (foundation for free), but the fun is felt in week one.

### Combat loop

- **Setup:** Player (HP) vs. one enemy (HP). Turn-based.
- **Deck:** ~15 cards, hand-seeded from notebook words. Each card =
  an **association image** + the (hidden) Spanish word + audio + a damage value.
- **A turn:** Draw a hand of ~5. The player gets a few actions per turn. To **play** a
  card, they must *prove they know it*: the card shows **only the association image**, the
  Spanish hidden. Pass the challenge → the card resolves, deals damage, juicy hit.
  Fail → the card **fizzles** (wasted action, possible counter-hit) and that word is
  flagged to resurface later. **Recall is the casting cost.**
- **Enemy turn:** Enemy attacks for some damage; the player must survive. (v0 = one
  simple enemy; varied "enemy types that demand different skills" is a future hook.)
- **Run structure:** 2–3 fights back-to-back. Between fights, a small reward — add a new
  word-card or upgrade an existing one. Losing all HP ends the run (roguelike restart);
  clearing all fights completes the run.

### The challenge modality for v0: **tap-to-choose** (option a)

Image shown → tap the correct Spanish word among 4 options. Chosen because:
- It is **verifiable** — you can't self-grade your way to victory (rejected the honor-system
  option for exactly this reason — "it's not much of a game if you can grade yourself to a win").
- It keeps the **fast, punchy** Slay-the-Spire tempo the project is targeting.
- It is quiet, mic-free, shy-friendly, and bus-playable.

It is the *pedagogically weakest* option (recognition, not production), and we accept that
for v0 because the **challenge layer is pluggable** — tile-assembly recall and, eventually,
voice drop in later on a proven foundation without touching the game.

Mitigation to raise the skill ceiling even in v0: make distractors **devious** —
near-synonyms and words the player personally confuses, not random throwaways.

### Mastery & upgrade system (SRS in disguise)

Spaced repetition and roguelike deckbuilding are the same shape, so we map them directly:

- A freshly-added word is a **Level-1 shaky card**.
- Each clean correct play **levels the card up**: it hits harder, **and the association
  image simplifies** — full scene → icon → bare glyph. The visual scaffolding falls away as
  the word sticks.
- Mastering a card literally makes the deck stronger. Failed recalls flag a word to
  resurface (a recurring "mini-boss" until tamed).

### Game feel / juice (non-negotiable for proving "fun")

Screen shake on hit, damage numbers, satisfying SFX, card-play animation. Game feel is
*what the POC is testing*; it cannot be an afterthought.

### POC success criteria

The loop demonstrably produces the **"one more run"** itch:
*see image → quick correct play → satisfying hit → build deck → play again.*

## Tech Stack

- **TypeScript + Vite** (already the project's environment per `.lxrc.yml`).
- **PixiJS v8** as the 2D WebGL renderer. (Pure renderer, "you architect the rest" —
  chosen over Phaser, whose opinionated API the user has bounced off before. WebGL is the
  user's bread and butter.)
- **No backend for v0** — deck is a JSON file; mastery/SRS state in `localStorage`.
  Neon Postgres waits in the wings for when accounts + deck sharing matter (v0.2+).
- **Phone testing:** `vite --host` over LAN — open the URL on a phone, no build/deploy.
- **Steam (eventually):** wrap the web build in a desktop shell (Electron = safe/battle-tested,
  Tauri = lighter) — a one-time *packaging* step done late; it constrains nothing in the POC.
- **Workflow:** all code + files, terminal + vscode/vim. No GUI engine IDE (a primary
  reason Godot was rejected for this project, alongside immature TS bindings and a card game
  not needing an engine's 3D/physics muscle).

## Explicitly Out of Scope for v0 (deferred, not forgotten)

- **Vocabulary ingestion** (drop in an ebook / song / movie → extract vocab at/around the
  player's level → customize include/exclude). A flagship v0.2 power-feature. v0 hand-seeds
  a JSON deck instead.
- **Deck create/edit/share + social** layer. Cross-game, valuable, later.
- **Voice modality + pronunciation scoring** (the real long-term tech unknown — a spectrum
  from "did you say the right word" to "was the accent good"). Ships on the proven loop.
- **Varied enemy types** that demand different skills (listening enemy, grammar-golem,
  conversation boss). A rich future hook; v0 has one simple enemy.
- **Player-forged association "minting" ritual** (vs. auto-generated art). A great future
  design fork; v0 uses pre-made association art for its seed deck.
- **Multiplayer / constructed (Magic-style) mode.** The sequel, not the pilot.
- **Backend, accounts, persistence beyond `localStorage`.**

## Known Risks / Open Questions

- **Abstract vocabulary vs. single-image association.** Concrete nouns (apple, tree) are
  easy to depict wordlessly; abstract words (*voluntad, apurado, exigente*) are hard to
  convey with one image and no translation. **Mitigation:** deliberately scope the v0 seed
  deck's vocabulary to words that *can* carry a clear visual association. Pushing the
  abstract-word representation problem is future work.
- **Voice & pronunciation scoring** (deferred) remains the headline technical unknown for
  later versions.
- Exact tuning numbers (HP totals, hand size, energy/actions per turn, damage values,
  mastery thresholds, number of fights) are starting guesses to be set and play-tested
  during implementation.

## Future Vision (context, not v0 commitments)

- Reusable **voice-to-text + tunable pronunciation thresholds** as a standalone tool.
- **Vocabulary ingestion** from ebooks/songs/movies, leveled to the learner.
- **Deck editor + sharing**, social, cross-game decks.
- Additional **game fantasies** sharing the same content + challenge layers: telenovela
  visual novel (listening + branching narrative), eavesdropper detective (pure listening
  comprehension), speed-translation rhythm game, living-city sim.
- A richer roguelike with **enemy types that each demand a different skill** (vocab,
  listening, conjugation, full-sentence conversation judged live by an LLM).
