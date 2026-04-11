import { describe, it } from "mocha";
import { browser, expect } from "@wdio/globals";

describe("app launches", () => {
  it("should display the app window", async () => {
    const title = await browser.getTitle();
    expect(title).toBeDefined();
  });
});
