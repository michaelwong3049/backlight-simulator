import { test, expect } from '@playwright/test';

test('GPUEngine execute function', async ({ page }) => {
  await page.goto('http://localhost:3000');

  await expect(page).toHaveScreenshot("initializedScreenshot.png", { maxDiffPixels: 150 });

  const expectedScreenshots = ["screenshot1.png", "screenshot2.png", "screenshot3.png"];

  const video = await page.waitForSelector("video");
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(2000);
    await video.click();
    await expect(page).toHaveScreenshot(expectedScreenshots[i], { maxDiffPixels: 150 });
    await video.click(); 
  }
});

