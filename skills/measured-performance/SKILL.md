---
name: measured-performance
description: Establish comparable performance measurements and test one bottleneck hypothesis at a time.
---

# Measured performance

Use this skill in `performance-optimizer`, or pass its evidence contract through the lead to a matching developer.
Do not delegate from a leaf agent. Retain ordinary planning, approval, security review, and correctness checks.

1. Identify the user-visible slow path and objective. Distinguish latency, throughput, startup, and resource use.
2. Inspect existing benchmarks, traces, datasets, and commands. Prefer safe, local, repeatable measurements.
3. Record the baseline: revision, command, input shape and size, environment, cache state, repetitions, and metric.
4. Trace the cost. State one falsifiable bottleneck hypothesis and the smallest change that can test it.
5. Implement only the approved change. Establish data ownership before caching or concurrency.
6. Re-run the same measurement under comparable conditions, with the same correctness checks.
7. Report baseline and candidate values, variance or measurement limits, and the user-visible consequence.

Prefer eliminating work before caching or parallelizing it. For a cache, specify invalidation and memory bounds.
For concurrency, check shared state, ordering, capacity, and failure handling. Shared outputs require one owner.
Do not rank a hot loop over startup without evidence about the actual workload.

A faster microbenchmark does not prove a faster application. A different dataset does not establish a fair comparison.
Do not invent an improvement percentage, significance claim, or fixed speedup quota.
If no measurement can run safely, return a measurement plan and `BLOCKED`, not an estimated improvement presented as
fact.
Preserve original benchmark evidence. Do not delete user work or alter the acceptance target to hide a regression.

This procedure includes adapted pstack principles. Retain [the MIT notice](LICENSE-pstack.txt) when copying it.
