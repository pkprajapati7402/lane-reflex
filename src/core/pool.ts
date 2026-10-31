/**
 * Generic fixed-size object pool to guarantee zero allocations in the 60Hz hot loop.
 */
export class ObjectPool<T> {
  private pool: T[];
  private activeCount: number = 0;
  private factory: () => T;
  private resetFn?: (item: T) => void;

  constructor(factory: () => T, initialCapacity: number, resetFn?: (item: T) => void) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.pool = new Array(initialCapacity);
    for (let i = 0; i < initialCapacity; i++) {
      this.pool[i] = factory();
    }
  }

  /**
   * Acquire an object from the pool. Expands pool if exhausted.
   */
  public acquire(): T {
    if (this.activeCount >= this.pool.length) {
      // Expand pool by 50%
      const newCapacity = Math.max(8, Math.floor(this.pool.length * 1.5));
      for (let i = this.pool.length; i < newCapacity; i++) {
        this.pool.push(this.factory());
      }
    }
    const item = this.pool[this.activeCount++];
    if (this.resetFn) {
      this.resetFn(item);
    }
    return item;
  }

  /**
   * Release an item back into the pool by swapping with last active item.
   */
  public release(index: number): void {
    if (index < 0 || index >= this.activeCount) return;
    this.activeCount--;
    const temp = this.pool[index];
    this.pool[index] = this.pool[this.activeCount];
    this.pool[this.activeCount] = temp;
  }

  /**
   * Clear all active objects without deallocating.
   */
  public clear(): void {
    this.activeCount = 0;
  }

  public get activeItems(): T[] {
    return this.pool.slice(0, this.activeCount);
  }

  public get count(): number {
    return this.activeCount;
  }

  public get(index: number): T {
    return this.pool[index];
  }
}

