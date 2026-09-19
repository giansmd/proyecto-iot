import type { UsageDTO } from "@iot/shared";
import type { UsageRepository } from "../../domain/ports.js";

export class GetUsageUseCase {
  constructor(
    private readonly usage: UsageRepository,
    private readonly budgetUsd: number,
  ) {}

  async execute(): Promise<UsageDTO> {
    const totals = await this.usage.totals();
    const spentUsd = Number(totals.costUsd.toFixed(6));
    return {
      budgetUsd: this.budgetUsd,
      spentUsd,
      remainingUsd: Number(Math.max(0, this.budgetUsd - spentUsd).toFixed(6)),
      calls: totals.calls,
      promptTokens: totals.promptTokens,
      completionTokens: totals.completionTokens,
      blocked: spentUsd >= this.budgetUsd,
    };
  }
}
