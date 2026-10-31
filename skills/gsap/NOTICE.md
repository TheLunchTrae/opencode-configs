# GSAP skills provenance

The files in `references/` derive from the eight `skills/gsap-*/SKILL.md` files in
[greensock/gsap-skills](https://github.com/greensock/gsap-skills/tree/aed9cfd3277740755f6bfc1155c7aa645403b760),
pinned at commit `aed9cfd3277740755f6bfc1155c7aa645403b760`.

Copyright (c) 2026 GreenSock. These skill materials use the MIT license, reproduced in [LICENSE](LICENSE).
This license covers the reference materials, not the separately distributed GSAP runtime.

Local adaptation groups the topic skills behind one optional entrypoint, replaces skill cross-references with local links,
and removes generic library-selection recommendations and pointers to omitted example projects.
The adaptation corrects the horizontal-scroll example's pixel offset, scroll linkage, and refresh behavior,
and removes a duplicate Nuxt type declaration and its unused plugin list. Trailing whitespace is normalized.
It also corrects refresh-priority ordering, `unitize` usage, `shuffle` mutation semantics, `contextSafe` cleanup claims,
and the Flip `scale` and `nested` descriptions.
The entrypoint adds project-scope, installation, accessibility,
and lifecycle safeguards. Runtime packages, examples, branding assets, and upstream discovery metadata are not included.
