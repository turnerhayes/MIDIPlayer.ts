enum ModulatorTypes {
  // No controller is to be used. The output of this controller module should be treated as
  // if its value were set to '1'. It should not be a means to turn off a modulator.
  "No Controller" = 0,
  // The controller source to be used is the velocity value which is sent from the MIDI
  // note-on command which generated the given sound.
  "Note-On Velocity" = 2,
  // The controller source to be used is the key number value which was sent from the
  // MIDI note-on command which generated the given sound.
  "Note-On Key Number" = 3,
  // The controller source to be used is the poly-pressure amount that is sent from the
  // MIDI poly-pressure command.
  "Poly Pressure" = 10,
  // The controller source to be used is the channel pressure amount that is sent from the
  // MIDI channel-pressure command.
  "Channel Pressure" = 13,
  // The controller source to be used is the pitch wheel amount which is sent from the
  // MIDI pitch wheel command
  "Pitch Wheel" = 14,
  // The controller source to be used is the pitch wheel sensitivity amount which is sent
  // from the MIDI RPN 0 pitch wheel sensitivity command.
  "Pitch Wheel Sensitivity" = 16,
  // The controller source is the output of another modulator. This is NOT SUPPORTED
  // as an Amount Source.
  "Link" = 127,
}

export default ModulatorTypes;
