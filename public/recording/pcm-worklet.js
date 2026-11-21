/*
 * The recorder's live audio for the live transcriber (thread ac47b1df): the
 * microphone at the device's rate, turned into 16 kHz mono 16-bit PCM in
 * quarter-second pieces, with the piece's loudness for the sound bar. Runs on
 * the audio thread; the page sends each piece to the transcriber.
 */
class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.carry = 0;
    this.piece = new Int16Array(4000);
    this.filled = 0;
    this.sumSquares = 0;
    this.paused = false;
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.paused === 'boolean') this.paused = event.data.paused;
    };
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    // Paused: silence goes on, so the transcriber's 15-second idle close never fires.
    for (let at = this.carry; at < channel.length; at += this.ratio) {
      const sample = this.paused ? 0 : Math.max(-1, Math.min(1, channel[Math.floor(at)]));
      this.piece[this.filled] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.sumSquares += sample * sample;
      this.filled += 1;
      if (this.filled === this.piece.length) {
        const level = Math.sqrt(this.sumSquares / this.piece.length);
        this.port.postMessage({ pcm: this.piece.buffer, level }, [this.piece.buffer]);
        this.piece = new Int16Array(4000);
        this.filled = 0;
        this.sumSquares = 0;
      }
    }
    this.carry = (this.carry + Math.ceil((channel.length - this.carry) / this.ratio) * this.ratio) - channel.length;
    return true;
  }
}

registerProcessor('lawexa-pcm', PcmWorklet);
