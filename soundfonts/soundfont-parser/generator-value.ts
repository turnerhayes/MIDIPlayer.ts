export default class GeneratorValue {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  get range(): [number, number] {
    return [
      // tslint:disable-next-line:no-bitwise
      this.value & 0xFF,
      // tslint:disable-next-line:no-bitwise
      this.value >> 8,
    ];
  }

  get signedValue(): number {
    // convert unsigned to signed value
    return (
      // tslint:disable-next-line:no-bitwise
      (this.value >> 7) ?
        -1 :
        1
    // tslint:disable-next-line:no-bitwise
    ) * (this.value & 0x7F);
  }

  get unsignedValue(): number {
    return this.value;
  }

  public toJSON() {
    return {
      asRange: this.range,
      asSignedValue: this.signedValue,
      asUnsignedValue: this.unsignedValue,
    };
  }
}
