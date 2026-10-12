## Independent design review

Send every implementation design to `code-reviewer`. For architecture, system, or high-level designs, also dispatch
`architecture-reviewer` as a sibling. Do not add architecture review without a structural decision.
Use `security-reviewer` for security-sensitive designs: authentication, authorization, user input, database queries,
file operations, external APIs, cryptography, payments, or sensitive data.
Run independent reviews in parallel on stable inputs. Resolve CRITICAL and HIGH findings in the design and repeat
affected reviews before presenting it for approval.
General, architecture, and security reviews are separate requirements.
