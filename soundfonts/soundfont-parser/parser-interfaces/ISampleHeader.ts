import SampleLinkTypes from "../sample-link-types";

export default interface ISampleHeader {
  start: number;
  end: number;
  loopStart: number;
  loopEnd: number;
  originalPitch: number;
  pitchCorrection: number;
  sampleLink: number;
  sampleLinkType: SampleLinkTypes;
  sampleName: string;
  sampleRate: number;
}
