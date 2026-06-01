export const INITIAL_COUNT = 1_000_000;
const BLOCK_SIZE = 1024;
const BITMAP_WORDS = Math.ceil(INITIAL_COUNT / 32);
const BLOCK_COUNT = Math.ceil(INITIAL_COUNT / BLOCK_SIZE);

/** Bit 1 = initial ID is selected (unavailable in the initial pool). */
const selectedBitmap = new Uint32Array(BITMAP_WORDS);
const blockAvailableCounts = new Uint16Array(BLOCK_COUNT);

let selectedInitialCount = 0;

for (let blockIndex = 0; blockIndex < BLOCK_COUNT; blockIndex += 1) {
  const blockStart = blockIndex * BLOCK_SIZE;
  blockAvailableCounts[blockIndex] = Math.min(BLOCK_SIZE, INITIAL_COUNT - blockStart);
}

function blockIndexFor(numberId: number): number {
  return Math.floor((numberId - 1) / BLOCK_SIZE);
}

function isInitialSelected(numberId: number): boolean {
  const bitIndex = numberId - 1;
  const wordIndex = bitIndex >>> 5;
  const bit = bitIndex & 31;
  return (selectedBitmap[wordIndex] & (1 << bit)) !== 0;
}

function setBitmapSelected(numberId: number, selected: boolean): void {
  const bitIndex = numberId - 1;
  const wordIndex = bitIndex >>> 5;
  const bit = bitIndex & 31;
  const mask = 1 << bit;
  if (selected) {
    selectedBitmap[wordIndex] |= mask;
  } else {
    selectedBitmap[wordIndex] &= ~mask;
  }
}

export function getInitialAvailableCount(): number {
  return INITIAL_COUNT - selectedInitialCount;
}

export function setInitialSelected(numberId: number, selected: boolean): void {
  if (numberId < 1 || numberId > INITIAL_COUNT) return;
  const already = isInitialSelected(numberId);
  if (already === selected) return;

  const block = blockIndexFor(numberId);
  setBitmapSelected(numberId, selected);
  if (selected) {
    selectedInitialCount += 1;
    blockAvailableCounts[block] -= 1;
  } else {
    selectedInitialCount -= 1;
    blockAvailableCounts[block] += 1;
  }
}

function findNthInitialAvailable(n: number): number {
  let remaining = n;

  for (let block = 0; block < BLOCK_COUNT; block += 1) {
    const availableInBlock = blockAvailableCounts[block];
    if (remaining >= availableInBlock) {
      remaining -= availableInBlock;
      continue;
    }

    const blockStart = block * BLOCK_SIZE + 1;
    const blockEnd = Math.min((block + 1) * BLOCK_SIZE, INITIAL_COUNT);
    for (let numberId = blockStart; numberId <= blockEnd; numberId += 1) {
      if (isInitialSelected(numberId)) continue;
      if (remaining === 0) return numberId;
      remaining -= 1;
    }
  }

  return INITIAL_COUNT + 1;
}

function findNextInitialAvailable(fromNumberId: number): number {
  for (let numberId = fromNumberId; numberId <= INITIAL_COUNT; numberId += 1) {
    if (!isInitialSelected(numberId)) return numberId;
  }
  return INITIAL_COUNT + 1;
}

export function getInitialAvailablePage(offset: number, limit: number): string[] {
  const initialAvailable = getInitialAvailableCount();
  const items: string[] = [];
  let remaining = limit;

  if (offset < initialAvailable && remaining > 0) {
    const initialTake = Math.min(remaining, initialAvailable - offset);
    let numberId = findNthInitialAvailable(offset);

    for (let index = 0; index < initialTake; index += 1) {
      items.push(String(numberId));
      numberId = findNextInitialAvailable(numberId + 1);
    }

    remaining -= initialTake;
  }

  return items;
}

/** For filtered scans: walk available initial IDs in order. */
export function visitInitialAvailable(visitor: (numberId: number) => boolean | void): void {
  for (let block = 0; block < BLOCK_COUNT; block += 1) {
    if (blockAvailableCounts[block] === 0) continue;

    const blockStart = block * BLOCK_SIZE + 1;
    const blockEnd = Math.min((block + 1) * BLOCK_SIZE, INITIAL_COUNT);
    for (let numberId = blockStart; numberId <= blockEnd; numberId += 1) {
      if (isInitialSelected(numberId)) continue;
      if (visitor(numberId) === false) return;
    }
  }
}

export function isInitialIdSelected(numberId: number): boolean {
  return isInitialSelected(numberId);
}

export function resetAvailability(): void {
  selectedBitmap.fill(0);
  selectedInitialCount = 0;
  for (let blockIndex = 0; blockIndex < BLOCK_COUNT; blockIndex += 1) {
    const blockStart = blockIndex * BLOCK_SIZE;
    blockAvailableCounts[blockIndex] = Math.min(BLOCK_SIZE, INITIAL_COUNT - blockStart);
  }
}
