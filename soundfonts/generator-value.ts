export default class GeneratorValue {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  get range(): [number, number] {
    return [
      // tslint:disable-next-line:no-bitwise
      this.value & 0xF,
      // tslint:disable-next-line:no-bitwise
      this.value >> 4,
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
      range: this.range,
      signedValue: this.signedValue,
      unsignedValue: this.unsignedValue,
    };
  }
}
