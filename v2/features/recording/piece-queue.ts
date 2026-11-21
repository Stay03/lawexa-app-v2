import { retryDelayMs } from './recording-model';

/**
 * The saved audio's pieces on their way to the server (thread ac47b1df).
 *
 * MediaRecorder hands over a piece every 30 seconds. Each gets the next number
 * and goes up in order, one at a time. A failed upload is tried again after
 * 2, 4, 8 … up to 30 seconds, for as long as the recording lasts, so a short
 * loss of signal costs nothing. The server keeps the first copy of a number,
 * so sending one twice is safe.
 *
 * `savedPieces` counts the pieces the server holds from 0 without a gap: the
 * "Saved up to 12:30" line. `drain()` waits until every piece is up, for Stop.
 */
export class PieceQueue {
  private readonly pieces: Blob[] = [];
  private readonly saved = new Set<number>();
  private sending = false;
  private stopped = false;
  private waiters: (() => void)[] = [];
  private readonly upload: (seq: number, piece: Blob) => Promise<void>;
  private readonly onSaved: (savedPieces: number) => void;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(
    upload: (seq: number, piece: Blob) => Promise<void>,
    onSaved: (savedPieces: number) => void,
    wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.upload = upload;
    this.onSaved = onSaved;
    this.wait = wait;
  }

  /** The next piece from the recorder. Empty pieces (a pause) are skipped. */
  push(piece: Blob): void {
    if (this.stopped || piece.size === 0) return;
    this.pieces.push(piece);
    void this.sendNext();
  }

  /** How many pieces the recording has so far; the last one's number is this minus 1. */
  get count(): number {
    return this.pieces.length;
  }

  get savedPieces(): number {
    let count = 0;
    while (this.saved.has(count)) count += 1;
    return count;
  }

  /** The numbers not yet on the server. */
  get missing(): number[] {
    return this.pieces.map((_, seq) => seq).filter((seq) => !this.saved.has(seq));
  }

  /** Resolves once every piece pushed so far is on the server. */
  drain(): Promise<void> {
    if (this.missing.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Send again the pieces the server says it lacks (Stop's 409). */
  resend(seqs: number[]): void {
    for (const seq of seqs) this.saved.delete(seq);
    void this.sendNext();
  }

  /** The tab is closing for good: stop retrying. */
  abandon(): void {
    this.stopped = true;
  }

  private async sendNext(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      for (;;) {
        const seq = this.missing[0];
        if (seq === undefined || this.stopped) break;
        let attempt = 0;
        for (;;) {
          try {
            await this.upload(seq, this.pieces[seq]);
            this.saved.add(seq);
            this.onSaved(this.savedPieces);
            break;
          } catch {
            if (this.stopped) return;
            attempt += 1;
            await this.wait(retryDelayMs(attempt));
          }
        }
      }
    } finally {
      this.sending = false;
    }
    if (this.missing.length === 0) {
      const waiters = this.waiters;
      this.waiters = [];
      for (const resolve of waiters) resolve();
    }
  }
}
