export interface TextEncoderLike {
  encode(text: string): number[];
  normalize(vector: number[]): number[];
}

export function encodeText(encoder: TextEncoderLike, text: string): number[] {
  return encoder.normalize(encoder.encode(text));
}
