import { describe, expect, it } from "vitest";
import { assertSafeWebhookUrl, isBlockedIpAddress } from "./safe-outbound";

describe("safe outbound", () => {
  it("bloqueia redes privadas em webhooks e permite em SSH", () => {
    expect(isBlockedIpAddress("127.0.0.1", "webhook")).toBe(true);
    expect(isBlockedIpAddress("127.0.0.1", "ssh")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254", "ssh")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.5", "webhook")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.5", "ssh")).toBe(false);
    expect(isBlockedIpAddress("8.8.8.8", "webhook")).toBe(false);
  });

  it("exige HTTPS sem credenciais embutidas", async () => {
    await expect(assertSafeWebhookUrl("http://example.com/hook")).rejects.toThrow(/HTTPS/);
    await expect(assertSafeWebhookUrl("https://user:pass@example.com/hook")).rejects.toThrow(
      /Credenciais/,
    );
  });
});
