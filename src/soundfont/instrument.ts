interface IInstrumentConstructorArgs {
  id: number;
}

export default class Instrument {
  public id: number;

  constructor({ id }: IInstrumentConstructorArgs) {
    this.id = id;
  }
}
