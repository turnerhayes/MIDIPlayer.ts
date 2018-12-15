import ISampleHeader from "./parser-interfaces/ISampleHeader";
import SampleLinkTypes from "./sample-link-types";

export interface ISampleConstructorParameters {
  header: ISampleHeader;
  linkedSample?: Sample;
  data: DataView;
  sampleIndex: number;
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

  public get sampleLinkType(): SampleLinkTypes {
    return this.header.sampleLinkType;
  }

  public get sampleLinkIndex(): number {
    return this.header.sampleLink;
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

  public sampleIndex: number;

  public linkedSample?: Sample;

  private header: ISampleHeader;

  constructor({
    header,
    linkedSample,
    data,
    sampleIndex,
  }: ISampleConstructorParameters) {
    this.header = header;
    this.linkedSample = linkedSample;
    this.data = data;
    this.sampleIndex = sampleIndex;
  }

  public toJSON() {
    return {
      ...this.header,
    };
  }
}
