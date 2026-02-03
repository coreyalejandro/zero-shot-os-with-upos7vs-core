import { expect, test } from "@playwright/test";

test("component inventory route is wired and visible", async ({ page }) => {
  await page.goto("/");

  const navLink = page.getByRole("link", { name: "Component Inventory" });
  await expect(navLink).toBeVisible();
  await navLink.click();

  await expect(page).toHaveURL(/\/component-inventory$/);
  await expect(
    page.getByRole("heading", { name: "Component Inventory" })
  ).toBeVisible();

  const totalLabel = page.getByText(/Total Components: \d+/);
  await expect(totalLabel).toBeVisible();

  const rows = page.getByTestId("component-inventory-row");
  await expect(rows.first()).toBeVisible();
});
