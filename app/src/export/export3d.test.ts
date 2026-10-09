import { describe, expect, it, vi } from "vitest";
import { exportSceneScreenshot } from "./export3d";
import * as downloadModule from "./download";

describe("exportSceneScreenshot", () => {
  it("captura o canvas como PNG e aciona o download", () => {
    const canvas = document.createElement("canvas");
    canvas.toDataURL = vi.fn().mockReturnValue("data:image/png;base64,FAKE");
    const downloadSpy = vi.spyOn(downloadModule, "downloadDataUrl").mockImplementation(() => {});

    exportSceneScreenshot(canvas, "teste.png");

    expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
    expect(downloadSpy).toHaveBeenCalledWith("data:image/png;base64,FAKE", "teste.png");
    vi.restoreAllMocks();
  });
});
