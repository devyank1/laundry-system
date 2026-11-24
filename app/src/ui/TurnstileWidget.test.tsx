import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { TurnstileWidget } from "./TurnstileWidget";

afterEach(() => {
  delete window.turnstile;
});

describe("TurnstileWidget", () => {
  it("renderiza com a site key, repassa o token e reinicia quando pedido", async () => {
    let opts: Record<string, unknown> = {};
    const ts = {
      render: vi.fn((_el: HTMLElement, o: Record<string, unknown>) => {
        opts = o;
        return "w1";
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    window.turnstile = ts;
    const onToken = vi.fn();
    const { rerender, unmount } = render(<TurnstileWidget siteKey="0xSITE" onToken={onToken} resetSignal={0} />);
    await waitFor(() => expect(ts.render).toHaveBeenCalled());
    expect(opts.sitekey).toBe("0xSITE");
    (opts.callback as (t: string) => void)("tok");
    expect(onToken).toHaveBeenLastCalledWith("tok");
    (opts["expired-callback"] as () => void)();
    expect(onToken).toHaveBeenLastCalledWith(null);
    rerender(<TurnstileWidget siteKey="0xSITE" onToken={onToken} resetSignal={1} />);
    expect(ts.reset).toHaveBeenCalledWith("w1");
    unmount();
    expect(ts.remove).toHaveBeenCalledWith("w1");
  });
});
