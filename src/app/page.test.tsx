import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the title and add-photos button", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Gallery Frame Maker");
    expect(html).toContain("Add photos");
  });
});
