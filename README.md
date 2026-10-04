# retirement-calculator

A browser-only retirement cashflow and savings projection built with React, TypeScript and Vite. Default amounts are fictional examples, not personal financial information.

## Development

Requires Node.js 24+ and npm.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
```

## Multiple accounts

Use **Configure accounts** to add, edit or remove up to 20 savings sources in a responsive drawer. Each has a name, account type, balance, monthly contribution, annual price growth and dividend / interest yield. Save applies the draft; Cancel, Close and Escape discard it. At least one account is required. Reset restores the fictional example (a $50,000 retirement account, $500 monthly contribution, 4% growth and 2% yield, over 30 years).

The main view shows combined starting balance and contributions, a combined projection, and each account’s final balance. Each account is projected independently before totals are summed. Types are descriptive labels only in Savings growth; Retirement cashflow applies the access and tax assumptions below.

## Savings growth calculation assumptions

- Price growth **excludes** dividends and interest. Annual total return is `priceGrowth + incomeYield`, with no cross-product. If a supplied rate already includes income, enter it as growth with yield 0. For cash, set growth to 0 and enter an assumed interest yield.
- The total is treated as an effective annual return, smoothed into monthly growth using `expm1(log1p(totalReturn / 100) / 12)`. This is a simplified reinvestment assumption, not a payout-date simulation. Income is reinvested in the same account and is not added again as a separate cash flow.
- Constant contributions are added to their respective accounts at each month’s end. Year zero is the initial balance. Annual rows follow the twelfth contribution.
- Total invested is starting balances plus contributions. Growth / loss is the difference between balance and invested, including reinvested income. USD values are rounded only for display.
- No inflation, fees, taxes, withdrawals, market volatility, employer match, contribution caps or account eligibility rules are modeled. This is an educational illustration, not financial advice or guaranteed performance.
- Years: integer 0–80. Per account: price growth −99% to 30%, income yield 0% to 30%, combined return at most 30%, balance $0–$1 billion, monthly contribution $0–$10 million. Blank/nonfinite values are rejected.

## Retirement cashflow

The default mode adds working/retired phases, configurable ages, income targets, account-aware withdrawals, simplified federal taxes and ACA MAGI visibility. Change account balances in the existing drawer; enter cost basis/Roth qualification/Rule of 55 details under **Account access & tax assumptions**. Switching modes preserves current in-memory edits. Reset plan resets planner settings; the Savings growth reset resets account examples.

See [ROADMAP.md](ROADMAP.md) for implemented/deferred scope, complete modeling limits and official research sources. State taxes are zero by request. Federal rules and the ACA reference are explicitly frozen to base year 2026 for future scenarios. All inputs are fictional until edited.

The pure monthly engine is in `src/retirement.ts`; versioned federal constants and gain stacking are in `src/tax.ts`; UI is in `src/RetirementPlanner.tsx`. Existing `src/projection.ts` remains unchanged.

### Validation

`npm test` runs calculation and boundary tests, including all v2 tests. `npm run build` typechecks and builds. Browser smoke checks are in `scripts/browser-smoke.mjs`; with Playwright installed and the dev server running, run `node scripts/browser-smoke.mjs`. Set `CHROMIUM_PATH` and `TEST_URL` if needed. The cloud environment supplies Playwright and `/usr/bin/chromium`; they are test-only and are not application dependencies. Checks include responsive widths, 200% text, labels, dialog focus, editing/validation, mode state, and no persisted inputs. This is not a formal screen-reader or WCAG audit.

## Privacy

All calculations run locally in the browser. There is no application backend, analytics, browser storage, database, account connection or transmission of input values. Refreshing resets the fictional example. The host can process ordinary site requests independently of the calculator.

## Source and deployment

This GitHub repository is the source of truth. The privately deployed Site uses an explicit copy of the reviewed application source in its separate managed source repository. There is no automatic GitHub-to-Sites sync. Future changes must be copied, checked, built and published explicitly. The `.openai/hosting.json` manifest identifies the Site and static `dist` output; it contains no credentials. Site access and GitHub repository visibility are separate settings.
