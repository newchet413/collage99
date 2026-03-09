const path = require("path");
const { test, expect } = require("@playwright/test");

const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9QjQAAAAASUVORK5CYII=";

function filePayload(name) {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPng, "base64"),
  };
}

function appUrl() {
  const filePath = path.join(__dirname, "..", "index.html");
  return `file:///${filePath.replace(/\\/g, "/")}`;
}

test("loads the app shell", async ({ page }) => {
  await page.goto(appUrl());
  await expect(page.getByRole("heading", { name: "collage99" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
});

test("uploads photos and renders tiles", async ({ page }) => {
  await page.goto(appUrl());
  await page.locator("#imagesInput").setInputFiles([filePayload("one.png"), filePayload("two.png")]);
  await expect(page.locator(".tile")).toHaveCount(2);
});

test("undo and redo work via keyboard", async ({ page }) => {
  await page.goto(appUrl());
  await page.locator("#imagesInput").setInputFiles([filePayload("one.png")]);
  await expect(page.locator(".tile")).toHaveCount(1);

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator(".tile")).toHaveCount(0);

  await page.keyboard.press("Control+z");
  await expect(page.locator(".tile")).toHaveCount(1);

  await page.keyboard.press("Control+y");
  await expect(page.locator(".tile")).toHaveCount(0);
});

test("adds a text overlay", async ({ page }) => {
  await page.goto(appUrl());
  await page.locator("#imagesInput").setInputFiles([filePayload("one.png")]);
  await page.locator("#textInput").fill("Hello collage99");
  await page.getByRole("button", { name: "Add Text" }).click();
  await expect(page.locator(".text-overlay")).toHaveCount(1);
  await expect(page.locator(".text-overlay")).toContainText("Hello collage99");
});

test("canvas size, preview zoom, and text space update the preview", async ({ page }) => {
  await page.goto(appUrl());
  await page.locator("#imagesInput").setInputFiles([filePayload("one.png")]);

  const before = await page.locator("#collageCanvas").evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
    readout: document.getElementById("canvasSizeReadout")?.textContent,
  }));

  await page.fill("#canvasWidthInput", "3000");
  await page.dispatchEvent("#canvasWidthInput", "input");
  await page.fill("#canvasHeightInput", "1800");
  await page.dispatchEvent("#canvasHeightInput", "input");
  await expect(page.locator("#canvasSizeReadout")).toHaveText("3000 x 1800");

  const afterSize = await page.locator("#collageCanvas").evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
  }));
  expect(afterSize.width).toBeGreaterThan(0);
  expect(afterSize.height).toBeGreaterThan(0);

  await page.fill("#previewZoomInput", "160");
  await page.dispatchEvent("#previewZoomInput", "input");
  const afterZoom = await page.locator("#collageCanvas").evaluate((el) => el.clientWidth);
  expect(afterZoom).toBeGreaterThan(afterSize.width);

  await page.check("#textZoneEnabledInput");
  await page.selectOption("#textZonePositionInput", "right");
  await page.fill("#textZoneSizeInput", "40");
  await page.dispatchEvent("#textZoneSizeInput", "input");
  await expect(page.locator(".text-zone")).toHaveCount(1);
});

test("export uses selected format, quality, and canvas dimensions", async ({ page }) => {
  await page.goto(appUrl());
  await page.locator("#imagesInput").setInputFiles([filePayload("one.png")]);

  await page.evaluate(() => {
    window.__exportCapture = null;
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function patched(type, quality) {
      window.__exportCapture = {
        width: this.width,
        height: this.height,
        type: type || "image/png",
        quality: typeof quality === "number" ? quality : null,
      };
      return original.call(this, type || "image/png", quality);
    };
  });

  await page.fill("#canvasWidthInput", "2400");
  await page.dispatchEvent("#canvasWidthInput", "input");
  await page.fill("#canvasHeightInput", "1300");
  await page.dispatchEvent("#canvasHeightInput", "input");
  await page.selectOption("#exportFormatInput", "jpeg");
  await page.fill("#exportQualityInput", "75");
  await page.dispatchEvent("#exportQualityInput", "change");
  await page.getByRole("button", { name: "Export" }).click();
  await page.waitForFunction(() => window.__exportCapture !== null);

  const jpegCapture = await page.evaluate(() => window.__exportCapture);
  expect(jpegCapture.width).toBe(2400);
  expect(jpegCapture.height).toBe(1300);
  expect(jpegCapture.type).toBe("image/jpeg");
  expect(jpegCapture.quality).toBeCloseTo(0.75, 2);

  await page.selectOption("#exportFormatInput", "png");
  await page.evaluate(() => {
    window.__exportCapture = null;
  });
  await page.getByRole("button", { name: "Export" }).click();
  await page.waitForFunction(() => window.__exportCapture !== null);
  const pngCapture = await page.evaluate(() => window.__exportCapture);
  expect(pngCapture.type).toBe("image/png");
});

test("stress: uploads 50 images in one collage", async ({ page }) => {
  await page.goto(appUrl());
  const files = Array.from({ length: 50 }, (_, i) => filePayload(`img-${i + 1}.png`));
  await page.locator("#imagesInput").setInputFiles(files);
  await expect(page.locator(".tile")).toHaveCount(50, { timeout: 15000 });
  await expect(page.locator(".empty-state")).toHaveCount(0);
});

test("text style controls are used during export rendering", async ({ page }) => {
  await page.goto(appUrl());
  await page.locator("#imagesInput").setInputFiles([filePayload("one.png")]);
  await page.locator("#textInput").fill("Styled text export check");
  await page.getByRole("button", { name: "Add Text" }).click();

  await page.evaluate(() => {
    window.__fillTextCapture = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function patched(text, x, y, maxWidth) {
      window.__fillTextCapture.push({
        textAlign: this.textAlign,
        shadowBlur: this.shadowBlur,
        font: this.font,
        text,
      });
      return originalFillText.call(this, text, x, y, maxWidth);
    };
  });

  await page.selectOption("#textAlignInput", "center");
  await page.uncheck("#textShadowInput");
  await page.fill("#textSizeInput", "72");
  await page.dispatchEvent("#textSizeInput", "input");
  await expect(page.locator(".text-overlay").first()).toHaveCSS("font-size", "72px");
  await page.getByRole("button", { name: "Export" }).click();
  await page.waitForFunction(() => Array.isArray(window.__fillTextCapture) && window.__fillTextCapture.length > 0);

  let capture = await page.evaluate(() => window.__fillTextCapture);
  expect(capture.length).toBeGreaterThan(0);
  expect(capture.some((c) => c.textAlign === "center")).toBeTruthy();
  expect(capture.some((c) => c.shadowBlur === 0)).toBeTruthy();
  expect(capture.some((c) => c.text.includes("Styled text export check"))).toBeTruthy();

  await page.evaluate(() => {
    window.__fillTextCapture = [];
  });
  await page.selectOption("#textAlignInput", "right");
  await page.check("#textShadowInput");
  await page.getByRole("button", { name: "Export" }).click();
  await page.waitForFunction(() => Array.isArray(window.__fillTextCapture) && window.__fillTextCapture.length > 0);

  capture = await page.evaluate(() => window.__fillTextCapture);
  expect(capture.length).toBeGreaterThan(0);
  expect(capture.some((c) => c.textAlign === "right")).toBeTruthy();
  expect(capture.some((c) => c.shadowBlur > 0)).toBeTruthy();
});
