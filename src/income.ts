import type { FilingStatus } from "./tax.ts";
/** IRS Publication 915 Worksheet 1, ordinary nonnegative benefit case. */
export function taxableSocialSecurity(
  gross: number,
  otherIncome: number,
  exemptInterest: number,
  filing: FilingStatus,
  livedTogether = true,
) {
  if (
    ![gross, otherIncome, exemptInterest].every(
      (v) => Number.isFinite(v) && v >= 0,
    )
  )
    throw new RangeError("Invalid Social Security income.");
  const combined = otherIncome + exemptInterest + gross / 2;
  if (filing === "separate" && livedTogether)
    return Math.min(0.85 * gross, 0.85 * combined);
  const lower = filing === "joint" ? 32000 : 25000,
    upper = filing === "joint" ? 44000 : 34000;
  if (combined <= lower) return 0;
  if (combined <= upper) return Math.min(gross / 2, (combined - lower) / 2);
  return Math.min(
    0.85 * gross,
    0.85 * (combined - upper) + Math.min(gross / 2, (upper - lower) / 2),
  );
}
/** Pub 590-B Appendix B Table III (effective 2022), ages 72–120+. */
export const UNIFORM_FACTORS = [
  27.4, 26.5, 25.5, 24.6, 23.7, 22.9, 22, 21.1, 20.2, 19.4, 18.5, 17.7, 16.8,
  16, 15.2, 14.4, 13.7, 12.9, 12.2, 11.5, 10.8, 10.1, 9.5, 8.9, 8.4, 7.8, 7.3,
  6.8, 6.4, 6, 5.6, 5.2, 4.9, 4.6, 4.3, 4.1, 3.9, 3.7, 3.5, 3.4, 3.3, 3.1, 3,
  2.9, 2.8, 2.7, 2.5, 2.3, 2,
];
export function rmdStartAge(birthDate: string): number {
  if (birthDate < "1949-07-01") return 70.5;
  const year = Number(birthDate.slice(0, 4));
  if (year <= 1950) return 72;
  // 1959 paragraph reserved in 2024 final regulations. Explicit UI assumption.
  return year <= 1959 ? 73 : 75;
}
export function ownerRmd(priorDecemberBalance: number, attainedAge: number) {
  if (
    !Number.isFinite(priorDecemberBalance) ||
    priorDecemberBalance < 0 ||
    !Number.isInteger(attainedAge) ||
    attainedAge < 72 ||
    attainedAge > 120
  )
    throw new RangeError(
      "RMD needs a prior December 31 balance and attained age 72–120.",
    );
  return priorDecemberBalance / UNIFORM_FACTORS[attainedAge - 72];
}
/** Pub 590-B Appendix B Table I, ages 18–65. Notice 2022-6 permits single-life SEPP. */
export const SINGLE_FACTORS = [
  67, 66, 65, 64.1, 63.1, 62.1, 61.1, 60.2, 59.2, 58.2, 57.3, 56.3, 55.3, 54.4,
  53.4, 52.5, 51.5, 50.5, 49.6, 48.6, 47.7, 46.7, 45.7, 44.8, 43.8, 42.9, 41.9,
  41, 40, 39, 38.1, 37.1, 36.2, 35.3, 34.3, 33.4, 32.5, 31.6, 30.6, 29.8, 28.9,
  28, 27.1, 26.2, 25.4, 24.5, 23.7, 22.9,
];
export function seppPayment(
  balance: number,
  attainedAge: number,
  method: "rmd" | "amortization",
  ratePercent: number,
) {
  if (
    !Number.isFinite(balance) ||
    balance < 0 ||
    !Number.isInteger(attainedAge) ||
    attainedAge < 18 ||
    attainedAge > 65 ||
    !["rmd", "amortization"].includes(method)
  )
    throw new RangeError("SEPP calculation supports single-life ages 18–65.");
  const n = SINGLE_FACTORS[attainedAge - 18];
  if (method === "rmd") return balance / n;
  // Deliberately bounded to 0–5%. Higher AFR-based ceilings require dated verification.
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 5)
    throw new RangeError("SEPP amortization rate must be 0–5%.");
  const r = ratePercent / 100;
  return r === 0
    ? balance / n
    : (balance * r) / -Math.expm1(-n * Math.log1p(r));
}
