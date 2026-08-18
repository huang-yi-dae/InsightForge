import { describe, it, expect } from "vitest";
import { checkStyle, countStyleFlags } from "./style-check";

describe("checkStyle", () => {
  it("空文本返回空", () => {
    expect(checkStyle("")).toEqual([]);
    expect(countStyleFlags("")).toBe(0);
  });

  it("命中中文废话词", () => {
    const flags = checkStyle("其实这个非常重要");
    const words = flags.map((f) => f.word);
    expect(words).toContain("其实");
    expect(words).toContain("非常");
  });

  it("中文命中位置正确", () => {
    const text = "我觉得可以";
    const f = checkStyle(text).find((x) => x.word === "我觉得")!;
    expect(text.slice(f.index, f.index + f.length)).toBe("我觉得");
  });

  it("同一个词多次出现都命中", () => {
    const flags = checkStyle("非常非常好");
    expect(flags.filter((f) => f.word === "非常")).toHaveLength(2);
  });

  it("英文 filler 词边界匹配，大小写不敏感", () => {
    const flags = checkStyle("This is Really just a test");
    const words = flags.map((f) => f.word.toLowerCase());
    expect(words).toContain("really");
    expect(words).toContain("just");
  });

  it("英文不误伤词内子串（justice 不算 just）", () => {
    expect(checkStyle("justice for all").some((f) => f.word.toLowerCase() === "just")).toBe(false);
  });

  it("英文短语（含空格）能命中", () => {
    expect(checkStyle("I did this in order to win").some((f) => f.word.toLowerCase() === "in order to")).toBe(true);
  });

  it("结果按位置升序", () => {
    const flags = checkStyle("非常好，其实还行");
    for (let i = 1; i < flags.length; i++) {
      expect(flags[i].index).toBeGreaterThanOrEqual(flags[i - 1].index);
    }
  });

  it("无废话词返回空", () => {
    expect(checkStyle("清晰而克制的一句话。")).toHaveLength(0);
  });

  it("countStyleFlags 返回命中总数", () => {
    expect(countStyleFlags("其实非常")).toBe(2);
  });
});
