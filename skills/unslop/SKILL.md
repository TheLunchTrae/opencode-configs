---
name: unslop
description:
  Use when the user asks to unslop, polish, clean up, or redesign an AI-looking interface, or when reviewing a UI with
  generic gradients, glows, emoji labels, hype copy, uneven spacing, or excessive motion.
license: CC-BY-4.0
metadata:
  author: Damir Sokolovsky
  source: https://github.com/heydamir/unslop
  upstream-revision: 4652254daff586ff4739849395a127b56f7f8cc7
---

# Unslop

Adapted for OpenCode from **unslop by Damir Sokolovsky** ([@heydamir](https://x.com/heydamir)). The
[upstream source](https://github.com/heydamir/unslop/tree/4652254daff586ff4739849395a127b56f7f8cc7) and this adaptation
are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Keep this attribution and the
[notice](NOTICE.md) with copies and adaptations. No endorsement is implied.

Fix the craft and keep the product. Preserve features, content, section order, and established branding. Give the screen
a character derived from its purpose, not from a fashionable template. Keep navigation, buttons, borders, and labels
quiet. Put richness into one or two meaningful content moments, such as a useful chart, a product preview, or an object
from the product's world.

This native skill uses the tools available in the current OpenCode session. It grants no new permissions. The upstream
snapshot and story-video scripts are not included. Automatic site capture and story-video rendering are unsupported by
this adaptation. Do not reference absent scripts or promise a recording without suitable tools.

## Workflow

1. **Inspect the screen.** Find its source files and inspect an actual render when available. For a URL without source,
   use an authorized browser tool to inspect it. Work on a local reproduction only when that is within the request. For
   a screenshot without editable source, reproduce the original before redesigning it. Explain that a reproduction is a
   handoff artifact, not a change to the live site.
2. **Audit.** Read [signs.md](references/signs.md). List each observed sign and its location. Preserve deliberate brand
   choices and useful existing behavior. These signs are design clues, not automatic deletions.
3. **Choose the scope.** Heavy slop across several categories calls for the full process. Light slop calls for targeted
   polish: keep the palette, type, layout, and visuals, and fix only audited problems. Put larger ideas in the report.
   If there is no slop, say so and suggest at most two or three precise refinements. Apply those only when authorized.
   Do not redesign a good screen merely to make it different.
4. **Set the direction.** Show the audit and the five lines below before editing. Wait for a direction decision unless
   the user has already authorized autonomous design choices. Reuse existing authorization rather than asking again.
5. **Apply nine passes in order.** Complete each pass across the whole screen before the next. For a substantial
   rewrite, plan the passes in order, then implement them together without skipping a pass. Read
   [tokens.md](references/tokens.md) for starting values. Keep a sound existing design system.
6. **Verify.** Render the result, compare it with the audit, and check the criteria below. Keep iterations focused.
   Continue when a known defect remains. State any unavailable visual or interaction checks.
7. **Report.** Give the direction, changes by applicable pass, remaining issues, verification limits, and any needed
   image prompts. Include unverified claims and any assets still required. Do not claim that an unrendered interface was
   visually checked.

## Direction

Write five short lines from the product's purpose and audience:

- **Product:** What it does and for whom, in one plain sentence.
- **Character:** Two or three concrete words, such as calm, exact, and warm. Avoid generic clean, modern, or premium.
- **World:** A place or material that belongs to the product, such as paper and ink, instruments, or maps. Use it to
  guide the accent, neutral tint, and visuals.
- **Moments:** One or two content elements that deserve rich color, material, or detail. State what they communicate.
- **Signature:** One small, useful detail applied consistently, such as keycaps or a route line.

Derive a new answer for the actual product. Keep established logos, colors, and typefaces unless their change is
authorized.

## 1. Spacing

- Use a 4px grid, with 2px adjustments inside small controls and optical centering exceptions.
- Give sibling rows and cards consistent heights, gaps, and padding. Keep related items closer than separate groups.
- Align icon boxes, label starts, and numeric columns. Remove arbitrary offsets that break alignment.
- Start near 16px padding for compact panels, 20–24px for cards, and 24–32px for page edges.
- Keep navigation dense: rows around 32–36px, gaps 2–4px, section labels 24px above and 8px below. Check the sidebar
  after this pass. Preserve usable touch targets.

## 2. Color

- Use one neutral ramp and three text roles: primary, secondary, and muted. Keep app and dashboard surfaces close to
  neutral grey. Landing pages can carry more of the world's tint.
- Use one restrained accent for chrome. Give semantic colors a real meaning. Rich content moments may use several hues
  when each serves the data or subject.
- Check text contrast against its actual background. Aim for at least 4.5:1 for ordinary text, including accent text.
  Darken an accent or use dark text when needed. Dark themes may use an off-white primary button.
- Remove decorative hue gradients, gradient text, glows, colored shadows, neon borders, and blurred background blobs.
  Preserve authorized branding. Small tonal gradients within a neutral surface can remain.
- Use quiet hairlines and surface steps for depth. Keep light-theme shadows small and neutral.

## 3. Icons

- Replace decorative emoji with the project's existing icon set, or remove icons that add no information. Lucide is a
  possible choice when no set exists, not permission to install a dependency.
- Keep a consistent size and stroke, starting around 16–18px and 1.5px.
- Use text-role colors, equal icon boxes, and an 8–10px label gap. Reserve colored status marks for real status.

## 4. Copy

- Describe what this product does for its audience. Use existing facts and product vocabulary.
- Use short labels and context titles instead of greetings, hype, exclamation marks, or repeated AI badges.
- State what a change compares with, such as `+12% vs last month`.
- Remove trailing periods from short labels and buttons. Keep normal punctuation in prose.
- Ask about claims only when their truth is unknown. Remove known fabricated claims within the authorized scope. Retain
  confirmed claims in quiet, specific language. Remove unconfirmed marketing claims within the authorized editing scope
  and report them.
- Use plausible fixture data only in mockups, clearly distinguished from real product data. Never invent customer
  counts, performance claims, product capabilities, or chart observations.

## 5. Type

- Choose type for the direction, retaining established brand fonts. Use one interface family and at most one partner.
- Use a small scale and mostly weights 400 and 500, with 600 for occasional emphasis. Build hierarchy with size and
  color rather than heavy weight.
- Use sentence case and normal tracking for labels. Never tighten small text to make it fit.
- Use tabular figures and consistent number formats. Avoid italic styling solely for emphasis.

## 6. Layout

- Preserve sections and their order. Improve alignment and proportions inside each section.
- Give apps real app proportions: a fluid viewport shell, sidebar around 240–280px, and content around 1440–1600px
  maximum. Preserve an intentional framed-window presentation rather than converting it into a different page type.
- Compose a landing hero around its product proof. A scene can place its subject on one side and text in calm space.
  Without a scene, use an asymmetric split or a large product preview. Do not impose the same layout on every product.
- Align long headlines left. Balance split layouts vertically and avoid dead empty areas.
- Keep one primary and at most one secondary hero action. Preserve other required actions elsewhere. Keep navigation
  quiet and make it usable on small screens.
- On mobile, stack in reading order. Simplify dense previews instead of shrinking their text to illegibility.

## 7. Details

- Relate nested radii: inner radius equals outer radius minus padding, with 4px as a useful minimum. Start near 8–10px
  for controls, 12–16px for cards, and 14–20px for panels. Avoid making everything a pill.
- Use quiet metadata, plain counts, and small keycaps. Give selected states a surface step and hairline.
- Give charts a hierarchy: one main chart, then smaller lists, tables, or different supporting views. Choose a line for
  trends, bars for comparisons, a stacked bar for shares, and a progress bar for a goal.
- Use muted grids and labels. Accent the important series or value; use multiple hues only to distinguish real series.
- Keep stat cards focused on a number, label, and comparison. Remove filler sparklines and ornamental mini charts. Vary
  the grid rhythm without changing the meaning or manufacturing data.
- Preserve visible keyboard focus, useful hover states, accessible names, and existing interaction behavior. Place the
  signature detail only where it belongs.

## 8. Visuals

Read [visuals.md](references/visuals.md) before this pass. Use [effects.md](references/effects.md) only for a fitting
treatment. Study the
[upstream examples](https://github.com/heydamir/unslop/tree/4652254daff586ff4739849395a127b56f7f8cc7/skills/unslop/references/refs)
when image viewing is available. Borrow their qualities, not their subject, palette, or layout.

- Remove decorative blobs, orbs, generic robots, and other filler. Prefer actual product content.
- Dashboards and settings usually need data or controls, not a generated hero image. Marketing, onboarding, and empty
  states may benefit from one relevant visual.
- Keep text and UI in code. Show only real product capabilities, using existing components where possible.
- Use available, authorized image tools. Reuse consent already given for paid generation. Otherwise confirm a paid
  generation's prompt, model, and size before spending.
- If the agreed design needs a visual and no suitable tool is available, report that limit and provide a coded product
  preview or useful prompt. Do not install a service, block the rest of the work, or claim an image was generated.
- Save generated assets into the project through available tools, within the authorized scope.

## 9. Motion

- Remove idle pulsing, breathing glows, parallax, and unrelated looping movement.
- Avoid `transition-all`, bouncy overshoot, and hover scaling. Prefer restrained color, opacity, and transform changes.
- Do not animate layout dimensions or large blurs. Use one easing curve and a few durations from the tokens.
- Use at most one entrance pattern with a short stagger. Preserve feedback that communicates real state.
- Respect reduced-motion preferences. Optional visual effects must pause off screen and release resources on teardown.

## Final check

- The original features, content, section order, brand constraints, and interactions remain intact.
- The audit is resolved within the agreed scope. Any deliberate exception is explained.
- Spacing, icon alignment, typography, number formats, and radii are consistent.
- Chrome is quiet. Richness belongs to specific product content, not decorative effects everywhere.
- Copy is specific and factual. No unverified claim or fixture data is presented as real.
- Text contrast, keyboard focus, readable mobile layout, and reduced motion have been checked where tools permit.
- The screen has a product-specific character rather than a new generic template.
- Report actual render and interaction evidence, unresolved assets, and any checks that could not run.
