export class RetrySafeIdempotencyKeys {
  private readonly pending = new Map<string, string>();

  keyFor(signature: string, prefix: string): string {
    const existing = this.pending.get(signature);
    if (existing) return existing;

    const key = `${prefix}-${crypto.randomUUID()}`;
    this.pending.set(signature, key);
    return key;
  }

  complete(signature: string, key: string): void {
    if (this.pending.get(signature) === key) this.pending.delete(signature);
  }

  clear(): void {
    this.pending.clear();
  }
}

export async function createDeterministicIdempotencyKey(prefix: string, signature: string): Promise<string> {
  const signatureBytes = new TextEncoder().encode(signature);
  const digest = await crypto.subtle.digest('SHA-256', signatureBytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${hash}`;
}
