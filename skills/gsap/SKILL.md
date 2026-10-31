---
name: gsap
description: Use when implementing, debugging, or reviewing GSAP animations, timelines, ScrollTrigger, GSAP plugins, or GSAP lifecycle integration in an existing project.
---

# GSAP

Use these references on demand for GSAP work. Inspect the project's installed GSAP version and animation conventions first.
Keep its existing libraries, design, and task scope. This skill does not select GSAP for unrelated animation requests.
Installation examples apply only to an authorized project dependency change, never to this personal configuration.

Read only the references needed for the task:

| Topic | Reference |
| --- | --- |
| Tweens, easing, stagger, responsive animation, reduced motion | [Core](references/core.md) |
| Sequencing, positions, nesting, playback | [Timeline](references/timeline.md) |
| Scroll-linked animation, pinning, refresh, cleanup | [ScrollTrigger](references/scrolltrigger.md) |
| Registration, text, SVG, dragging, layout transitions | [Plugins](references/plugins.md) |
| Mapping, snapping, ranges, collections | [Utilities](references/utils.md) |
| React scope, `useGSAP`, context cleanup | [React](references/react.md) |
| Vue, Nuxt, Svelte, component lifecycles | [Frameworks](references/frameworks.md) |
| Layout cost, batching, measurement | [Performance](references/performance.md) |

Respect `prefers-reduced-motion`. Reduce or omit nonessential movement, preserving readable content and functional interactions.
Use component-scoped targets. Revert contexts and media-query handlers, remove listeners, and release animation resources on teardown.
Keep motion consistent with the project's design. If Unslop is also in use, its restrained-motion direction still applies.
Do not add decorative animation solely because a reference demonstrates it.

Verify affected interactions, reduced-motion behavior, and repeated mount/unmount behavior with available project tools.
Report checks that could not run. Examples are references, not evidence that an integration works in the current project.
