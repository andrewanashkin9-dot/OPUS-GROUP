/**
 * How much one press of ± should move a quantity.
 *
 * A market line can be four doors or nine thousand bricks, and a fixed step
 * of one is useless at the second scale — nobody clicks a hundred times.
 * The step follows the order of magnitude, so a press is always worth about
 * a per cent of what is being counted.
 */
export function quantityStep(quantity: number): number {
  if (quantity >= 1000) return 100;
  if (quantity >= 200) return 10;
  return 1;
}
