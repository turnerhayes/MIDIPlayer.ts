enum TransformTypes {
  // The output value of the multiplier is to be fed directly to the summing node of the
  // given destination.
  "Linear" = 0,
  // The output value of the multiplier is to be the absolute value of the input value, as
  // defined by the relationship:
  //
  // output = square root ((input value)^2)
  //
  // or alternatively
  //
  // output = output * sign(output)
  "Absolute Value" = 2,
}

export default TransformTypes;
