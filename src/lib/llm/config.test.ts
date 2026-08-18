import { describe, it, expect } from "vitest";
import { isBlockedHost, sanitizeIncomingConfig } from "@/lib/llm/config";

// SSRF 防护：确认内网/环回/云元数据主机被拦，公网正常放行。
// 期望值为独立手写的具体样例，不复用被测实现的逻辑。

describe("isBlockedHost", () => {
  it("拦截环回与本机", () => {
    for (const h of ["localhost", "127.0.0.1", "::1", "0.0.0.0"]) {
      expect(isBlockedHost(h)).toBe(true);
    }
  });

  it("拦截云元数据 link-local 169.254.169.254", () => {
    expect(isBlockedHost("169.254.169.254")).toBe(true);
  });

  it("拦截 IPv4 私有网段", () => {
    for (const h of ["10.0.0.5", "192.168.1.1", "172.16.0.1", "172.31.255.255"]) {
      expect(isBlockedHost(h)).toBe(true);
    }
  });

  it("172.32.x 不属于私有段，放行", () => {
    expect(isBlockedHost("172.32.0.1")).toBe(false);
  });

  it("拦截内网域名后缀与 IPv6 本地地址", () => {
    expect(isBlockedHost("db.internal")).toBe(true);
    expect(isBlockedHost("printer.local")).toBe(true);
    expect(isBlockedHost("fd00::1")).toBe(true);
    expect(isBlockedHost("[::1]")).toBe(true);
  });

  it("放行正常公网主机", () => {
    for (const h of ["api.openai.com", "api.deepseek.com", "8.8.8.8"]) {
      expect(isBlockedHost(h)).toBe(false);
    }
  });
});

describe("sanitizeIncomingConfig", () => {
  const good = { baseUrl: "https://api.openai.com/v1", apiKey: "sk-xxxxxxxx", model: "gpt-4o-mini" };

  it("接受合法的公网 BYOK 配置", () => {
    expect(sanitizeIncomingConfig(good)).toEqual({ provider: "custom", ...good });
  });

  it("拒绝指向内网/云元数据的 baseUrl（SSRF）", () => {
    expect(sanitizeIncomingConfig({ ...good, baseUrl: "http://169.254.169.254/latest/meta-data" })).toBeNull();
    expect(sanitizeIncomingConfig({ ...good, baseUrl: "http://localhost:11434/v1" })).toBeNull();
    expect(sanitizeIncomingConfig({ ...good, baseUrl: "http://10.0.0.1/v1" })).toBeNull();
  });

  it("拒绝非 http(s) 协议与缺字段", () => {
    expect(sanitizeIncomingConfig({ ...good, baseUrl: "file:///etc/passwd" })).toBeNull();
    expect(sanitizeIncomingConfig({ ...good, apiKey: "" })).toBeNull();
    expect(sanitizeIncomingConfig(null)).toBeNull();
  });
});
