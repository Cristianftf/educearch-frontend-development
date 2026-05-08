import { expect, test } from "@playwright/test"

test("home page exposes entry points", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByText("EDUCEARCH")).toBeVisible()
  await expect(page.getByRole("button", { name: "Registrarse" })).toBeVisible()
})
