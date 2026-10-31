# UI UX Pro Max attribution

Source: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
at commit [`9a3f14f7423037ccb8feeb4fee7482291b9c820e`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/9a3f14f7423037ccb8feeb4fee7482291b9c820e).

Copyright (c) 2024 Next Level Builder. Distributed under the [MIT license](LICENSE).

`scripts/core.py` adapts `src/ui-ux-pro-max/scripts/core.py` by removing configuration and routing for omitted catalogs.
The selected CSV files are copied unchanged from `src/ui-ux-pro-max/data/`: styles, colors, charts, products,
typography, UX guidelines, landing patterns, and all stack references, including SwiftUI.
The data contains recommendations and links, not redistributed fonts, icon assets, or framework libraries.

`SKILL.md` adapts the upstream skill for optional OpenCode reference lookup.
`scripts/search.py` replaces the upstream entry point with an explicit domain-or-stack search interface and portable JSON output.
It uses the Python standard library and resolves imports and data relative to the skill directory.
It does not include the upstream design-system generator, persistence, CLI installer, templates, or unrelated catalogs.

Keep this notice and license with standalone copies of the skill.
