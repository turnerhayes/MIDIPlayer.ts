import IInstrumentSample from "./IInstrumentSample";
import IPreset from "./IPreset";
import Sample from "./sample";

export interface IInstrumentConstructorParameters {
  name: string;
  samples: IInstrumentSample[];
}

export default class Instrument {
  public readonly name: string;

  public readonly samples: IInstrumentSample[];

  constructor({
    name,
    samples,
  }: IInstrumentConstructorParameters) {
    this.name = name;
    this.samples = samples;
  }
}
