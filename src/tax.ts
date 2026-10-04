/** Frozen 2026 federal illustration. IRS Rev. Proc. 2025-32. */
export const TAX_RULES = {
  single: {
    label: "Single",
    deduction: 16100,
    brackets: [12400, 50400, 105700, 201775, 256225, 640600],
    gains: [49450, 545500],
  },
  joint: {
    label: "Married filing jointly / qualifying surviving spouse",
    deduction: 32200,
    brackets: [24800, 100800, 211400, 403550, 512450, 768700],
    gains: [98900, 613700],
  },
  head: {
    label: "Head of household",
    deduction: 24150,
    brackets: [17700, 67450, 105700, 201750, 256200, 640600],
    gains: [66200, 579600],
  },
  separate: {
    label: "Married filing separately",
    deduction: 16100,
    brackets: [12400, 50400, 105700, 201775, 256225, 384350],
    gains: [49450, 306850],
  },
} as const;
export type FilingStatus = keyof typeof TAX_RULES;
export function federalTax(
  ordinary: number,
  gains: number,
  status: FilingStatus,
) {
  if (
    ![ordinary, gains].every((x) => Number.isFinite(x) && x >= 0) ||
    !TAX_RULES[status]
  )
    throw new RangeError("Invalid federal tax inputs.");
  const r = TAX_RULES[status],
    o = Math.max(0, ordinary - r.deduction),
    g = Math.max(0, gains - Math.max(0, r.deduction - ordinary));
  let tax = 0,
    lower = 0;
  [...r.brackets, Infinity].forEach((upper, i) => {
    tax +=
      Math.max(0, Math.min(o, upper) - lower) *
      [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37][i];
    lower = upper;
  });
  const zero = Math.min(g, Math.max(0, r.gains[0] - o)),
    fifteen = Math.min(
      g - zero,
      Math.max(0, r.gains[1] - Math.max(o, r.gains[0])),
    );
  return tax + fifteen * 0.15 + (g - zero - fifteen) * 0.2;
}
