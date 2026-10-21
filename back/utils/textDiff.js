// A word-level comparison of two texts, for the editor's published-vs-draft view.

// The longest-common-subsequence table is tokensA x tokensB; above this size the diff falls back to
// "everything removed, everything added" instead of using that much memory.
const MAX_DIFF_CELLS = 4_000_000;

const SegmentTypeEnum = Object.freeze({ SAME: 'same', REMOVED: 'removed', ADDED: 'added' });

/** Compares two token lists. Returns segments { type, text } in order, with neighbouring same-type tokens joined. */
function diffTokens(oldTokens, newTokens, joiner) {
  const segments = [];
  const push = (type, token) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += joiner + token;
    else segments.push({ type, text: token });
  };

  if (oldTokens.length * newTokens.length > MAX_DIFF_CELLS) {
    if (oldTokens.length) segments.push({ type: SegmentTypeEnum.REMOVED, text: oldTokens.join(joiner) });
    if (newTokens.length) segments.push({ type: SegmentTypeEnum.ADDED, text: newTokens.join(joiner) });
    return segments;
  }

  // lengths[i][j] = length of the longest common subsequence of oldTokens[i..] and newTokens[j..].
  const columns = newTokens.length + 1;
  const lengths = new Uint32Array((oldTokens.length + 1) * columns);
  for (let i = oldTokens.length - 1; i >= 0; i--) {
    for (let j = newTokens.length - 1; j >= 0; j--) {
      lengths[i * columns + j] =
        oldTokens[i] === newTokens[j]
          ? lengths[(i + 1) * columns + j + 1] + 1
          : Math.max(lengths[(i + 1) * columns + j], lengths[i * columns + j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < oldTokens.length && j < newTokens.length) {
    if (oldTokens[i] === newTokens[j]) {
      push(SegmentTypeEnum.SAME, oldTokens[i]);
      i++;
      j++;
    } else if (lengths[(i + 1) * columns + j] >= lengths[i * columns + j + 1]) {
      push(SegmentTypeEnum.REMOVED, oldTokens[i++]);
    } else {
      push(SegmentTypeEnum.ADDED, newTokens[j++]);
    }
  }
  while (i < oldTokens.length) push(SegmentTypeEnum.REMOVED, oldTokens[i++]);
  while (j < newTokens.length) push(SegmentTypeEnum.ADDED, newTokens[j++]);
  return segments;
}

const splitWords = (text) => text.split(/\s+/).filter(Boolean);
const splitParagraphs = (text) => text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

/**
 * Compares the published text with the draft text. Paragraphs are compared first; a paragraph that was
 * changed (removed next to an added one) is compared word by word.
 * Returns { published, draft }: the segment lists to show on each side. The published side holds the same and
 * removed segments, the draft side holds the same and added ones. Each side is a list of paragraphs, and a paragraph is a list of segments { type, text }.
 */
function diffTexts(publishedText = '', draftText = '') {
  const paragraphSegments = diffTokens(splitParagraphs(publishedText), splitParagraphs(draftText), '\n\n');
  const published = [];
  const draft = [];

  // Paragraph segments hold one or more paragraphs joined by a blank line. Split them back to paragraphs.
  const paragraphsOf = (segment) => segment.text.split('\n\n');
  const addParagraphs = (side, type, paragraphs) =>
    paragraphs.forEach((paragraph) => side.push([{ type, text: paragraph }]));

  for (let index = 0; index < paragraphSegments.length; index++) {
    const segment = paragraphSegments[index];
    const next = paragraphSegments[index + 1];

    if (segment.type === SegmentTypeEnum.SAME) {
      addParagraphs(published, SegmentTypeEnum.SAME, paragraphsOf(segment));
      addParagraphs(draft, SegmentTypeEnum.SAME, paragraphsOf(segment));
    } else if (segment.type === SegmentTypeEnum.REMOVED && next && next.type === SegmentTypeEnum.ADDED) {
      // A changed block: compare word by word.
      const wordSegments = diffTokens(splitWords(segment.text), splitWords(next.text), ' ');
      published.push(wordSegments.filter((wordSegment) => wordSegment.type !== SegmentTypeEnum.ADDED));
      draft.push(wordSegments.filter((wordSegment) => wordSegment.type !== SegmentTypeEnum.REMOVED));
      index++;
    } else if (segment.type === SegmentTypeEnum.REMOVED) {
      addParagraphs(published, SegmentTypeEnum.REMOVED, paragraphsOf(segment));
    } else {
      addParagraphs(draft, SegmentTypeEnum.ADDED, paragraphsOf(segment));
    }
  }

  return { published, draft };
}

module.exports = { SegmentTypeEnum, diffTexts };
