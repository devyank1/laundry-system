import { describe, expect, it } from "vitest";
import { jwtAal, jwtSessionId } from "./jwt.ts";

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("jwtSessionId", () => {
  it("lê o session_id do payload", () => {
    expect(jwtSessionId(`h.${b64url(JSON.stringify({ session_id: "abc", sub: "u" }))}.sig`)).toBe("abc");
  });
  it("devolve null para token inválido ou sem session_id", () => {
    expect(jwtSessionId("lixo")).toBeNull();
    expect(jwtSessionId(`h.${b64url("{nao json")}.s`)).toBeNull();
    expect(jwtSessionId(`h.${b64url(JSON.stringify({ sub: "u" }))}.s`)).toBeNull();
  });
});

describe("jwtAal", () => {
  it("lê o nível de verificação (aal) do payload", () => {
    expect(jwtAal(`h.${b64url(JSON.stringify({ aal: "aal2" }))}.s`)).toBe("aal2");
  });
  it("devolve null sem aal ou com token inválido", () => {
    expect(jwtAal(`h.${b64url(JSON.stringify({ sub: "u" }))}.s`)).toBeNull();
    expect(jwtAal("lixo")).toBeNull();
  });
});
