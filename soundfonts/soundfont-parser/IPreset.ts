import IPresetInstrument from "./IPresetInstrument";

export default interface IPreset {
  name: string;
  MIDINumber: number;
  instruments: IPresetInstrument[];
}
