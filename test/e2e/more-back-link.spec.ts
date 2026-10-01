import { expect, test } from "@playwright/test";
import { MORE_HOSTED_HREFS } from "../../components/nav-links";

/**
 * Every page the More menu hosts carries `← More`, and it opens the menu
 * (#53, ADR-0068). The list is read from the menu itself, so a page added to
 * More is covered without touching this file.
 */
for (const href of MORE_HOSTED_HREFS) {
	test(`${href} has a way back to the More menu`, async ({ page }) => {
		await page.goto(href);
		const back = page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("button", {
			name: "← More",
		});
		await expect(back).toBeVisible();
		await back.click();
		const menu = page.getByRole("dialog", { name: "More" });
		await expect(menu).toBeVisible();
		await expect(menu.getByRole("link", { name: /Projects/ })).toBeVisible();
	});
}
