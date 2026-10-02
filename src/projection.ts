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
