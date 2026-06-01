type TrieNode = {
  children: Map<string, TrieNode>;
  ids: Set<string>;
};

function createNode(): TrieNode {
  return { children: new Map(), ids: new Set() };
}

export class SubstringIndex {
  private readonly root = createNode();

  insert(id: string): void {
    const length = id.length;
    for (let start = 0; start < length; start += 1) {
      let node = this.root;
      for (let index = start; index < length; index += 1) {
        const char = id[index];
        let child = node.children.get(char);
        if (!child) {
          child = createNode();
          node.children.set(char, child);
        }
        node = child;
        node.ids.add(id);
      }
    }
  }

  remove(id: string): void {
    const length = id.length;
    for (let start = 0; start < length; start += 1) {
      let node = this.root;
      for (let index = start; index < length; index += 1) {
        const char = id[index];
        const child = node.children.get(char);
        if (!child) break;
        node = child;
        node.ids.delete(id);
      }
    }
  }

  search(query: string): Set<string> {
    if (query === "") {
      return new Set();
    }

    let node = this.root;
    for (const char of query) {
      const child = node.children.get(char);
      if (!child) return new Set();
      node = child;
    }
    return node.ids;
  }
}

type NumericTrieNode = {
  children: Map<string, NumericTrieNode>;
  ids: number[];
  sorted: boolean;
};

function createNumericNode(): NumericTrieNode {
  return { children: new Map(), ids: [], sorted: true };
}

export class InitialNumericSubstringIndex {
  private readonly root = createNumericNode();

  insertNumber(numberId: number): void {
    const id = String(numberId);
    const length = id.length;
    for (let start = 0; start < length; start += 1) {
      let node = this.root;
      for (let index = start; index < length; index += 1) {
        const char = id[index];
        let child = node.children.get(char);
        if (!child) {
          child = createNumericNode();
          node.children.set(char, child);
        }
        node = child;
        node.ids.push(numberId);
        node.sorted = false;
      }
    }
  }

  build(count: number): void {
    for (let numberId = 1; numberId <= count; numberId += 1) {
      this.insertNumber(numberId);
    }
  }

  getMatchingNumbers(query: string): readonly number[] {
    if (query === "") return [];

    let node = this.root;
    for (const char of query) {
      const child = node.children.get(char);
      if (!child) return [];
      node = child;
    }

    if (!node.sorted) {
      node.ids.sort((left, right) => left - right);
      node.sorted = true;
    }
    return node.ids;
  }
}
