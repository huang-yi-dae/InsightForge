import { describe, it, expect } from "vitest";
import { pushSnapshot, snapshotSummary, type Snapshot } from "./history";

const T0 = new Date("2026-08-10T12:00:00.000Z");
const later = (ms: number) => new Date(T0.getTime() + ms);

describe("pushSnapshot", () => {
  const opts = { minGapMs: 1000, maxKeep: 3 };

  it("空内容不存", () => {
    expect(pushSnapshot([], "   ", T0, opts)).toEqual([]);
  });

  it("首条正常追加，最新在前", () => {
    const r = pushSnapshot([], "第一版", T0, opts);
    expect(r).toHaveLength(1);
    expect(r[0].content).toBe("第一版");
    expect(r[0].at).toBe(T0.toISOString());
  });

  it("内容相同不新增", () => {
    const list: Snapshot[] = [{ content: "同样", at: T0.toISOString() }];
    expect(pushSnapshot(list, "同样", later(5000), opts)).toBe(list);
  });

  it("间隔足够则新增一条", () => {
    const list = pushSnapshot([], "v1", T0, opts);
    const r = pushSnapshot(list, "v2", later(2000), opts);
    expect(r).toHaveLength(2);
    expect(r[0].content).toBe("v2");
    expect(r[1].content).toBe("v1");
  });

  it("间隔不足则替换最新（不增条、保留时间戳）", () => {
    const list = pushSnapshot([], "v1", T0, opts);
    const r = pushSnapshot(list, "v1-edit", later(500), opts);
    expect(r).toHaveLength(1);
    expect(r[0].content).toBe("v1-edit");
    expect(r[0].at).toBe(T0.toISOString()); // 时间戳保留
  });

  it("超过 maxKeep 丢最旧", () => {
    let list: Snapshot[] = [];
    list = pushSnapshot(list, "a", T0, opts);
    list = pushSnapshot(list, "b", later(2000), opts);
    list = pushSnapshot(list, "c", later(4000), opts);
    list = pushSnapshot(list, "d", later(6000), opts);
    expect(list).toHaveLength(3);
    expect(list.map((s) => s.content)).toEqual(["d", "c", "b"]);
  });
});

describe("snapshotSummary", () => {
  it("取首个非空行 + 非空白字数", () => {
    const s = { content: "\n  \n标题行\n下一行", at: T0.toISOString() };
    const { firstLine, chars } = snapshotSummary(s);
    expect(firstLine).toBe("标题行");
    expect(chars).toBe(6); // 标题行(3)+下一行(3)
  });
});
