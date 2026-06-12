/** The pluggable challenge seam. v0 ships tap-match; tile-assembly and voice
 *  implement the same shape later: present something, get a pass/fail choice. */
export interface TapChallenge {
  cardId: string;
  /** Display words (article included), shuffled. Exactly one is correct. */
  options: string[];
  correctWord: string;
}
