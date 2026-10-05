import { cacheGet, cacheSet } from "../../lib/cache";

describe("cache", () => {
  it("returns undefined on miss", () => {
    expect(cacheGet("missing-key-" + Math.random())).toBeUndefined();
  });

  it("returns the stored value on hit within TTL", () => {
    const key = "hit-" + Math.random();
    cacheSet(key, { foo: 1 }, 10_000);
    expect(cacheGet(key)).toEqual({ foo: 1 });
  });

  it("evicts and returns undefined after TTL expires", async () => {
    const key = "ttl-" + Math.random();
    cacheSet(key, "v", 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(cacheGet(key)).toBeUndefined();
  });
});
