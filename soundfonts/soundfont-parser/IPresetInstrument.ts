import Instrument from "./instrument";

/**
 * Mapping class that connects a preset with an instrument.
 */
export default interface IPresetInstrument {
  /**
   * The instrument that belongs to the preset
   */
  instrument: Instrument;

  /**
   * The range of MIDI key numbers that this instrument covers
   */
  keyRange?: [number, number];

  /**
   * The range of MIDI velocity values that this instrument covers
   */
  velocityRange?: [number, number];
}
