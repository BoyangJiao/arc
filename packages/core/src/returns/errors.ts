/**
 * @arc/core/returns — error types.
 *
 * See .specify/feature-specs/stage-3/twr-stage-3.md §决策 7 (XIRR convergence).
 */

/**
 * Thrown by `computeMwr` (XIRR Newton-Raphson) when iteration does not reach
 * the convergence tolerance within the iteration cap, or when the derivative
 * collapses to zero (degenerate cash-flow shape).
 *
 * UI surfaces this as "—" rather than letting `NaN` reach a price/return cell
 * (S3-AC-D.1.8).
 */
export class ConvergenceError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ConvergenceError";
    if (details !== undefined) {
      this.details = details;
    }
  }
}
