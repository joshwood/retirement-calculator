import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_URL || "http://localhost:5173");
await page.getByRole("heading", { name: "Work, retire, draw down" }).waitFor();
assert.equal(await page.locator("#plan-retirementYears").inputValue(), "65");
await page.locator("#plan-years").fill("");
await page.getByRole("alert").filter({ hasText: "Complete every" }).waitFor();
await page.locator("#plan-years").fill("45");
await page.locator("#plan-retirementMonths").fill("12");
await page.getByRole("alert").filter({ hasText: "0–11" }).waitFor();
await page.locator("#plan-retirementMonths").fill("6");
await page.getByRole("button", { name: "Savings growth", exact: true }).click();
await page.getByText("Your savings over time", { exact: true }).waitFor();
await page
  .getByRole("button", { name: "Retirement cashflow", exact: true })
  .click();
assert.equal(await page.locator("#plan-retirementMonths").inputValue(), "6");
const configure = page.getByRole("button", {
  name: "Configure accounts (1)",
  exact: true,
});
await configure.click();
await page.getByRole("dialog").waitFor();
await page.getByRole("button", { name: "Add account", exact: true }).click();
await page
  .getByLabel("Account name", { exact: true })
  .last()
  .fill("Bridge cash");
await page
  .getByLabel("Account type", { exact: true })
  .last()
  .selectOption("Savings / cash");
await page
  .getByLabel("Current balance ($)", { exact: true })
  .last()
  .fill("100000");
await page.getByRole("button", { name: "Save accounts", exact: true }).click();
await page
  .getByRole("button", { name: "Configure accounts (2)", exact: true })
  .waitFor();
assert.equal(await page.getByRole("dialog").count(), 0);
assert.equal(
  await page.evaluate(() => document.activeElement?.textContent),
  "Configure accounts (2)",
);
await page
  .getByRole("button", { name: "Configure accounts (2)", exact: true })
  .click();
await page
  .getByLabel("Account name", { exact: true })
  .first()
  .fill("Discard this");
await page.keyboard.press("Escape");
assert.equal(await page.getByText("Discard this", { exact: true }).count(), 0);
await page
  .getByLabel("Model Rule of 55 for this employer's pretax plan")
  .check();
await page.getByText(/Rule of 55 conditions are incomplete/).waitFor();
await page
  .getByLabel("Separation date for this plan's employer")
  .fill("2050-01-01");
await page.getByLabel(/I have verified this plan/).check();
await page.locator("#plan-filing").selectOption("joint");
await page.locator("#plan-mode").selectOption("percent");
await page.locator("#plan-withdrawalPercent").fill("5");
await page.locator("#plan-strategy").selectOption("magi");
await page
  .getByText("Optional SEPP 72(t): separate-account illustration", {
    exact: true,
  })
  .click();
await page.locator("#sepp-payment").fill("12000");
assert.match(
  await page.locator(".planner").textContent(),
  /illustrative monthly payments/,
);
await page.screenshot({
  path: "/tmp/retirement-qa/desktop.png",
  fullPage: false,
});
for (const width of [320, 390, 768, 1440]) {
  await page.setViewportSize({ width, height: 1000 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `overflow at ${width}`,
  );
  await page
    .getByRole("button", { name: "Configure accounts (2)", exact: true })
    .click();
  assert.ok(
    await page.evaluate(
      () => document.querySelector("dialog").scrollWidth <= innerWidth,
    ),
    `dialog overflow ${width}`,
  );
  await page.keyboard.press("Escape");
}
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "/tmp/retirement-qa/mobile.png",
  fullPage: false,
});
await page.setViewportSize({ width: 1440, height: 1000 });
await page.addStyleTag({ content: "html{font-size:200% !important}" });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "overflow at 200% text",
);
const missingLabels = await page
  .locator(".planner input:visible,.planner select:visible")
  .evaluateAll((els) => els.filter((el) => !el.labels?.length).length);
assert.equal(missingLabels, 0);
await page.reload();
assert.equal(await page.locator("#plan-retirementYears").inputValue(), "65");
await page
  .getByRole("button", { name: "Configure accounts (1)", exact: true })
  .waitFor();
assert.equal(
  await page.evaluate(() => localStorage.length + sessionStorage.length),
  0,
);
await page
  .getByRole("button", { name: "Configure accounts (1)", exact: true })
  .click();
await page.getByLabel("Account type", { exact: true }).selectOption("Roth IRA");
await page.getByRole("button", { name: "Save accounts", exact: true }).click();
await page
  .getByRole("alert")
  .filter({ hasText: "earliest same-owner" })
  .waitFor();
await page
  .getByLabel(/Earliest same-owner Roth IRA contribution tax year/)
  .fill("2026");
assert.equal(await page.getByRole("alert").count(), 0);
await page.getByLabel("Remaining regular contribution basis ($)").fill("");
await page.getByRole("alert").filter({ hasText: "Basis must be" }).waitFor();
await page.getByLabel("Remaining regular contribution basis ($)").fill("10000");
await page
  .getByRole("button", { name: "Configure accounts (1)", exact: true })
  .click();
await page.getByRole("button", { name: "Add account", exact: true }).click();
await page
  .getByLabel("Account type", { exact: true })
  .last()
  .selectOption("Roth IRA");
await page.getByRole("button", { name: "Save accounts", exact: true }).click();
await page
  .getByRole("alert")
  .filter({ hasText: "one pooled same-owner" })
  .waitFor();
await page.getByRole("button", { name: "Savings growth", exact: true }).click();
await page.getByText("Your savings over time", { exact: true }).waitFor();
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "PASS: planner editing, validation, preserved modes, drawer save/cancel/Escape/focus return, access, strategies, SEPP, 320/390/768/1440, 200% text, labels, memory-only state; no browser errors.",
);
