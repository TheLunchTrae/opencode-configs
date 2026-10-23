// Independent expectations for the shipped allocation and ordered policies, not a Composer resolver.
export type Permission = Record<string, string | Record<string, string>>;
export const memberships: Record<string, string[]> = {
  workflow: ['workflow-lead'],
  planning: ['architect', 'planner', 'planning-lead'],
  developers: [
    'csharp-developer',
    'doctrine-developer',
    'efcore-developer',
    'github-actions-developer',
    'gitlab-ci-developer',
    'go-developer',
    'implementation-lead',
    'laminas-developer',
    'php-developer',
    'react-developer',
    'typescript-developer',
    'general',
  ],
  reviewers: [
    'architecture-reviewer',
    'code-reviewer',
    'csharp-reviewer',
    'go-reviewer',
    'php-reviewer',
    'review-lead',
    'security-reviewer',
    'typescript-reviewer',
  ],
  refactoring: ['code-simplifier', 'performance-optimizer', 'refactor-cleaner'],
  documentation: ['doc-updater'],
  research: ['explore'],
  system: ['summary', 'compaction', 'title'],
  'developer-delegation': ['doc-updater', 'refactor-cleaner'],
  'delegating-reviewers': ['code-reviewer', 'security-reviewer'],
  'read-only': ['architect', 'planner', 'architecture-reviewer'],
};
export const movedPermissions = [
  'architect',
  'architecture-reviewer',
  'code-reviewer',
  'code-simplifier',
  'csharp-developer',
  'csharp-reviewer',
  'doc-updater',
  'doctrine-developer',
  'efcore-developer',
  'github-actions-developer',
  'gitlab-ci-developer',
  'go-developer',
  'go-reviewer',
  'laminas-developer',
  'performance-optimizer',
  'php-developer',
  'php-reviewer',
  'planner',
  'react-developer',
  'refactor-cleaner',
  'security-reviewer',
  'typescript-developer',
  'typescript-reviewer',
];
export const movedModels = ['doctrine-developer', 'efcore-developer', 'implementation-lead', 'performance-optimizer'];
export const retainedPolicies: Record<string, Permission> = {
  'implementation-lead': {
    edit: 'allow',
    question: 'allow',
    task: {
      '*': 'deny',
      'code-reviewer': 'allow',
      'architecture-reviewer': 'allow',
      'security-reviewer': 'allow',
      'code-simplifier': 'allow',
      'refactor-cleaner': 'allow',
      'performance-optimizer': 'allow',
      'doc-updater': 'allow',
      'github-actions-developer': 'allow',
      'gitlab-ci-developer': 'allow',
      'typescript-developer': 'allow',
      'react-developer': 'allow',
      'go-developer': 'allow',
      'csharp-developer': 'allow',
      'efcore-developer': 'allow',
      'php-developer': 'allow',
      'laminas-developer': 'allow',
      'doctrine-developer': 'allow',
      'typescript-reviewer': 'allow',
      'go-reviewer': 'allow',
      'csharp-reviewer': 'allow',
      'php-reviewer': 'allow',
      general: 'allow',
      explore: 'allow',
    },
  },
  'planning-lead': {
    edit: 'deny',
    bash: 'deny',
    question: 'allow',
    task: {
      '*': 'deny',
      planner: 'allow',
      architect: 'allow',
      'code-reviewer': 'allow',
      'architecture-reviewer': 'allow',
      'security-reviewer': 'allow',
      'typescript-reviewer': 'allow',
      'go-reviewer': 'allow',
      'csharp-reviewer': 'allow',
      'php-reviewer': 'allow',
      explore: 'allow',
    },
  },
  'review-lead': {
    edit: 'deny',
    question: 'allow',
    task: {
      '*': 'deny',
      'code-reviewer': 'allow',
      'architecture-reviewer': 'allow',
      'security-reviewer': 'allow',
      'typescript-reviewer': 'allow',
      'go-reviewer': 'allow',
      'csharp-reviewer': 'allow',
      'php-reviewer': 'allow',
      explore: 'allow',
    },
  },
  'workflow-lead': {
    edit: 'allow',
    question: 'allow',
    task: {
      '*': 'deny',
      planner: 'allow',
      architect: 'allow',
      'architecture-reviewer': 'allow',
      'code-reviewer': 'allow',
      'security-reviewer': 'allow',
      'code-simplifier': 'allow',
      'refactor-cleaner': 'allow',
      'performance-optimizer': 'allow',
      'doc-updater': 'allow',
      'github-actions-developer': 'allow',
      'gitlab-ci-developer': 'allow',
      'typescript-developer': 'allow',
      'react-developer': 'allow',
      'go-developer': 'allow',
      'csharp-developer': 'allow',
      'efcore-developer': 'allow',
      'php-developer': 'allow',
      'laminas-developer': 'allow',
      'doctrine-developer': 'allow',
      'typescript-reviewer': 'allow',
      'go-reviewer': 'allow',
      'csharp-reviewer': 'allow',
      'php-reviewer': 'allow',
      general: 'allow',
      explore: 'allow',
    },
  },
};
export const expectedPolicies: Record<string, Permission> = {
  'architecture-reviewer': { edit: 'deny', bash: 'deny' },
  ...Object.fromEntries(
    [
      'csharp-developer',
      'doctrine-developer',
      'efcore-developer',
      'github-actions-developer',
      'gitlab-ci-developer',
      'go-developer',
      'laminas-developer',
      'php-developer',
      'react-developer',
      'typescript-developer',
      'code-simplifier',
      'performance-optimizer',
      'general',
    ].map((name) => [name, { edit: 'allow' }]),
  ),
  ...Object.fromEntries(['architect', 'planner'].map((name) => [name, { edit: 'deny', bash: 'deny' }])),
  ...Object.fromEntries(
    ['csharp-reviewer', 'go-reviewer', 'php-reviewer', 'typescript-reviewer'].map((name) => [
      name,
      { edit: 'deny', task: 'deny' },
    ]),
  ),
  ...Object.fromEntries(
    ['code-reviewer', 'security-reviewer'].map((name) => [
      name,
      {
        edit: 'deny',
        task: {
          '*': 'deny',
          'typescript-reviewer': 'allow',
          'go-reviewer': 'allow',
          'csharp-reviewer': 'allow',
          'php-reviewer': 'allow',
        },
      },
    ]),
  ),
  ...Object.fromEntries(
    ['doc-updater', 'refactor-cleaner'].map((name) => [
      name,
      {
        edit: 'allow',
        task: {
          '*': 'deny',
          'typescript-developer': 'allow',
          'go-developer': 'allow',
          'csharp-developer': 'allow',
          'php-developer': 'allow',
        },
      },
    ]),
  ),
  ...retainedPolicies,
  explore: { edit: 'deny' },
  summary: {},
  compaction: {},
  title: {},
};
export const globalPermission: Permission = {
  read: { secrets: 'deny', 'secrets/*': 'deny', '*/secrets': 'deny', '*/secrets/*': 'deny' },
  bash: {
    '*': 'ask',
    'git status *': 'allow',
    'git diff *': 'allow',
    'git log *': 'allow',
    'git *--output*': 'ask',
    'git *>*': 'ask',
    'git checkout*': 'ask',
    'git commit*': 'ask',
    'git push*': 'ask',
    'sudo*': 'ask',
    'python*': 'ask',
    'git branch -D*': 'deny',
    'git clean -f*': 'deny',
    'git push --force*': 'deny',
    'git push -f*': 'deny',
    'git reset --hard*': 'deny',
    'rm -rf*': 'deny',
  },
  edit: { '*': 'ask' },
  task: { '*': 'deny' },
  'github_*': 'ask',
  'playwright_*': 'ask',
};

export function expectedModels(profile: string | null): Record<string, { model?: string; variant?: string }> {
  const result: Record<string, { model?: string; variant?: string }> = Object.fromEntries(
    [...new Set(Object.values(memberships).flat())].map((name) => [name, {}]),
  );
  const allocations: Record<string, string[]> = {
    primary: ['openai/gpt-6-astra', 'openai/gpt-5.6-sol', 'openai/gpt-5.6-terra'],
    'openai-latest': ['openai/gpt-6-astra', 'openai/gpt-6.1-sol', 'openai/gpt-6-luna'],
    'anthropic-latest': ['anthropic/claude-opus-5-5', 'anthropic/claude-sonnet-5-5', 'anthropic/claude-haiku-5-5'],
  };
  if (profile !== null) {
    const [reasoning, development, lightweight] = allocations[profile];
    for (const group of ['workflow', 'planning', 'reviewers']) {
      for (const name of memberships[group]) {
        result[name] = { model: reasoning, variant: 'high' };
      }
    }
    for (const group of ['developers', 'refactoring']) {
      for (const name of memberships[group]) {
        result[name] = { model: development, variant: 'medium' };
      }
    }
    for (const group of ['documentation', 'research']) {
      for (const name of memberships[group]) {
        result[name] = { model: lightweight, variant: 'medium' };
      }
    }
    for (const name of movedModels) {
      result[name] = { model: reasoning, variant: 'high' };
    }
  }
  for (const name of ['summary', 'compaction']) {
    result[name] = { model: 'openai/gpt-5.6-terra', variant: 'medium' };
  }
  result.title = { model: 'openai/gpt-5.6-luna', variant: 'low' };
  return result;
}
