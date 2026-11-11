declare module 'audiobuffer-to-wav' {
  export default function audioBufferToWav(buffer: { numberOfChannels: number; sampleRate: number; getChannelData(channel: number): Float32Array }, options?: { float32?: boolean }): ArrayBuffer
}
