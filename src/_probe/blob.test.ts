/**
 * @vitest-environment jsdom
 */
import { it, expect } from "vitest";
it("blob roundtrip", async () => {
  const b = new Blob([new Uint8Array([1,2,3,4,5]).buffer]);
  expect(b.size).toBe(5);
  const buf = await b.arrayBuffer();
  expect(buf.byteLength).toBe(5);
  expect(new Uint8Array(buf)[0]).toBe(1);
});
