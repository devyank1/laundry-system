import { describe, expect, it, vi } from "vitest";
import { downloadDataUrl } from "./download";

describe("downloadDataUrl", () => {
  it("cria um link temporário, clica nele e remove do DOM", () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });

    downloadDataUrl("data:text/plain,hello", "arquivo.txt");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
