# retirement-calculator

A browser-only retirement savings projection built with React, TypeScript and Vite. Default amounts are fictional examples, not personal financial information.

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

## Calculation assumptions

- Starting balance grows monthly; a constant contribution is added at each month's end.
- The entered return is an effective annual return. Monthly return is `expm1(log1p(annualReturn / 100) / 12)`.
- Growth is reinvested. Annual rows are captured after each year's twelfth contribution; year zero is the initial balance.
- USD amounts are rounded only for display. Negative returns and negative growth are supported.
- No inflation, fees, taxes, withdrawals, market volatility or asset allocation are modeled. This is an educational illustration, not financial advice or guaranteed performance.
- Years must be an integer from 0 to 80; annual returns may range from -99% to 30%. Starting balance is limited to $1 billion and monthly contributions to $10 million to keep inputs bounded.

## Privacy

All calculations run locally in the browser. There is no application backend, analytics, browser storage, database, account connection or transmission of input values. Refreshing resets the fictional example. The host can process ordinary site requests independently of the calculator.

## Source and deployment

This GitHub repository is the source of truth. The privately deployed Site uses an explicit copy of the reviewed application source in its separate managed source repository. There is no automatic GitHub-to-Sites sync. Future changes must be copied, checked, built and published explicitly. The `.openai/hosting.json` manifest identifies the Site and static `dist` output; it contains no credentials. Site access and GitHub repository visibility are separate settings.
