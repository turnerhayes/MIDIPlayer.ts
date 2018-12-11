declare module "lamejs" {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);

    encodeBuffer(left: any, right?: any): Int8Array;

    flush(): Int8Array;
  }
}
