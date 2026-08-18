import { describe, it, expect } from "vitest";
import { extractOutline } from "./outline";

describe("extractOutline", () => {
  it("空文本返回空", () => {
    expect(extractOutline("")).toEqual([]);
  });

  it("提取多级标题及行号", () => {
    const text = "# 一级\n正文\n## 二级\n### 三级";
    expect(extractOutline(text)).toEqual([
      { level: 1, text: "一级", line: 0 },
      { level: 2, text: "二级", line: 2 },
      { level: 3, text: "三级", line: 3 },
    ]);
  });

  it("忽略引用块里的 #", () => {
    const text = "> # 这是引用里的标题\n# 真标题";
    const out = extractOutline(text);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("真标题");
  });

  it("# 后必须有空格才算标题", () => {
    expect(extractOutline("#没有空格")).toHaveLength(0);
    expect(extractOutline("# 有空格")).toHaveLength(1);
  });

  it("去掉尾部装饰性 #", () => {
    expect(extractOutline("## 标题 ##")[0].text).toBe("标题");
  });

  it("最多 6 级，7 个 # 不算", () => {
    expect(extractOutline("####### 太多了")).toHaveLength(0);
    expect(extractOutline("###### 六级")).toHaveLength(1);
  });

  it("无标题返回空", () => {
    expect(extractOutline("就是一段普通正文\n没有任何标题")).toEqual([]);
  });
});
