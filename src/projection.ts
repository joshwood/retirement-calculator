export type Assumptions = { startingBalance: number; monthlyContribution: number; years: number; annualReturn: number };
export type ProjectionRow = { year: number; balance: number; invested: number; growth: number };
export const LIMITS = { startingBalance: 1_000_000_000, monthlyContribution: 10_000_000, years: 80 };
export function projectSavings(input: Assumptions): ProjectionRow[] {
  const { startingBalance, monthlyContribution, years, annualReturn } = input;
  if (!Object.values(input).every(Number.isFinite)) throw new RangeError('Enter a finite number for every assumption.');
  if (startingBalance < 0 || startingBalance > LIMITS.startingBalance) throw new RangeError('Starting balance must be between $0 and $1 billion.');
  if (monthlyContribution < 0 || monthlyContribution > LIMITS.monthlyContribution) throw new RangeError('Monthly contribution must be between $0 and $10 million.');
  if (!Number.isInteger(years) || years < 0 || years > LIMITS.years) throw new RangeError('Years must be a whole number from 0 to 80.');
  if (annualReturn < -99 || annualReturn > 30) throw new RangeError('Annual return must be between -99% and 30%.');
  const monthlyRate = Math.expm1(Math.log1p(annualReturn / 100) / 12);
  let balance = startingBalance;
  const rows: ProjectionRow[] = [{ year: 0, balance, invested: startingBalance, growth: 0 }];
  for (let month = 1; month <= years * 12; month++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (month % 12 === 0) {
      const invested = startingBalance + monthlyContribution * month;
      rows.push({ year: month / 12, balance, invested, growth: balance - invested });
    }
  }
  return rows;
}

export const ACCOUNT_TYPES = ['401(k) / 403(b)', 'Traditional IRA', 'Roth IRA', 'Taxable brokerage', 'Savings / cash', 'Other'] as const;
export type Account = {
  id: string;
  name: string;
  type: typeof ACCOUNT_TYPES[number];
  balance: number;
  priceGrowth: number;
  incomeYield: number;
  monthlyContribution: number;
};
export const MAX_ACCOUNTS = 20;
export function projectAccounts(accounts: Account[], years: number) {
  if (!accounts.length || accounts.length > MAX_ACCOUNTS) throw new RangeError('Configure between 1 and 20 accounts.');
  if (new Set(accounts.map(a => a.id)).size !== accounts.length) throw new RangeError('Account identifiers must be unique.');
  const byAccount = accounts.map(account => {
    if (!account.id || !account.name.trim() || account.name.length > 60) throw new RangeError('Give each account a name of 1–60 characters.');
    if (!ACCOUNT_TYPES.includes(account.type)) throw new RangeError('Choose a supported account type.');
    if (!Number.isFinite(account.priceGrowth) || account.priceGrowth < -99 || account.priceGrowth > 30) throw new RangeError('Price growth must be between -99% and 30%.');
    if (!Number.isFinite(account.incomeYield) || account.incomeYield < 0 || account.incomeYield > 30) throw new RangeError('Dividend / interest yield must be between 0% and 30%.');
    const annualReturn = account.priceGrowth + account.incomeYield;
    if (annualReturn > 30) throw new RangeError('Price growth plus dividend / interest yield must be at most 30%.');
    return { account, rows: projectSavings({startingBalance: account.balance, monthlyContribution: account.monthlyContribution, years, annualReturn}) };
  });
  const rows = byAccount[0].rows.map((row, index) => ({
    year: row.year,
    balance: byAccount.reduce((sum, item) => sum + item.rows[index].balance, 0),
    invested: byAccount.reduce((sum, item) => sum + item.rows[index].invested, 0),
    growth: byAccount.reduce((sum, item) => sum + item.rows[index].growth, 0),
  }));
  return { rows, byAccount };
}
