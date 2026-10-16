import { describe, expect, it, vi } from "vitest";

vi.mock("nitropack/runtime/internal", () => ({
  getGracefulShutdownConfig: () => ({
    disabled: false,
    signals: ["SIGTERM", "SIGINT"],
    timeout: 30_000,
    forceExit: true,
  }),
  trapUnhandledNodeErrors: vi.fn(),
}));

import type { Worker } from "node:cluster";
import { forwardSignalToWorkers } from "../../src/presets/node/runtime/node-cluster";

describe("node-cluster: forwardSignalToWorkers", () => {
  it("forwards the received signal to all alive workers", () => {
    const kill1 = vi.fn();
    const kill2 = vi.fn();
    const worker1 = {
      isDead: () => false,
      process: { kill: kill1 },
    } as unknown as Worker;
    const worker2 = {
      isDead: () => false,
      process: { kill: kill2 },
    } as unknown as Worker;

    const workers = {
      "1": worker1,
      "2": worker2,
    };

    forwardSignalToWorkers(workers, "SIGTERM");

    expect(kill1).toHaveBeenCalledWith("SIGTERM");
    expect(kill2).toHaveBeenCalledWith("SIGTERM");
  });

  it("skips dead or uninitialized workers", () => {
    const killAlive = vi.fn();
    const killDead = vi.fn();
    const aliveWorker = {
      isDead: () => false,
      process: { kill: killAlive },
    } as unknown as Worker;
    const deadWorker = {
      isDead: () => true,
      process: { kill: killDead },
    } as unknown as Worker;

    const workers = {
      "1": aliveWorker,
      "2": deadWorker,
      "3": undefined,
    };

    forwardSignalToWorkers(workers, "SIGINT");

    expect(killAlive).toHaveBeenCalledWith("SIGINT");
    expect(killDead).not.toHaveBeenCalled();
  });

  it("handles empty or undefined workers gracefully without throwing", () => {
    expect(() => forwardSignalToWorkers(undefined, "SIGTERM")).not.toThrow();
    expect(() => forwardSignalToWorkers({}, "SIGTERM")).not.toThrow();
  });

  it("handles worker with missing or dead process gracefully", () => {
    const workerWithoutProcess = {
      isDead: () => false,
      process: undefined,
    } as unknown as Worker;

    expect(() =>
      forwardSignalToWorkers({ "1": workerWithoutProcess }, "SIGTERM")
    ).not.toThrow();
  });
});
