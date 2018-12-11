import ISampleHeader from "./parser-interfaces/ISampleHeader";

export interface ISampleConstructorParameters {
  file: Buffer;
  header: ISampleHeader;
  dataOffset: number;
  data: DataView;
}

export default class Sample {
  public get name(): string {
    return this.header.sampleName;
  }

  public get sampleRate(): number {
    return this.header.sampleRate;
  }

  public get pitchCorrection(): number {
    return this.header.pitchCorrection;
  }

  public get originalPitch(): number {
    return this.header.originalPitch;
  }

  /**
   * The loop start and end, in samples (relative to the start of this sample's data)
   */
  public get loopRange(): [number, number] {
    return [
      this.header.loopStart - this.header.start,
      this.header.loopEnd - this.header.start,
    ];
  }

  public data: DataView;

  private file: Buffer;

  private header: ISampleHeader;

  private dataOffset: number;

  constructor({
    file,
    header,
    dataOffset,
    data,
  }: ISampleConstructorParameters) {
    this.file = file;
    this.header = header;
    this.dataOffset = dataOffset;
    this.data = data;
  }

  public toJSON() {
    return {
      ...this.header,
    };
  }
}
