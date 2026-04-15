/**
 * Commitlint config — Smart Attendance
 *
 * Scope picking convention (priority order):
 *   1. Module nghiệp vụ rõ ràng → auth / branches / employees / attendance /
 *      reports / dashboard / schedules / audit
 *   2. Infra cross-cutting trong 1 project layer → api / portal / mobile / shared
 *   3. Cross-project config → infra / ci / deps
 *   4. PROMPT_LOG.md → prompt-log
 *   5. Other docs (spec, erd, plans...) → docs
 *
 * Examples:
 *   ✅ feat(auth): add login endpoint
 *   ✅ feat(attendance): add check-in flow
 *   ✅ chore(api): bump nestjs to 11.2
 *   ✅ chore(portal): switch to standalone components
 *   ✅ chore(infra): upgrade docker compose
 *   ✅ docs(prompt-log): add T-005 entry
 *   ✅ docs(spec): clarify trust score weights
 *
 *   ❌ feat(api/auth): ...   (KHÔNG nested scope)
 *   ❌ feat(login): ...      (KHÔNG ad-hoc scope ngoài enum)
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // Business modules (docs/api-spec.md)
        'auth',
        'branches',
        'employees',
        'attendance',
        'reports',
        'dashboard',
        'schedules',
        'audit',
        // Nx projects (apps + libs)
        'api',
        'portal',
        'mobile',
        'shared',
        // Cross-cutting infra
        'db',
        'infra',
        'ci',
        'deps',
        // Documentation
        'docs',
        'prompt-log',
      ],
    ],
    'scope-empty': [2, 'never'],
    'subject-case': [0],
    'subject-max-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
