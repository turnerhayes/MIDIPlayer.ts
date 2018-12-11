export default interface ISoundfontHeaderInfo {
  bankName: string;
  copyright: string|null;
  comments: string|null;
  creationDate: string|null;
  engineers: string|null;
  product: string|null;
  soundEngine: string;
  soundfontTools: string|null;
  wavetableROM: string|null;
  wavetableRevision?: IVersionTag|null;
  version: IVersionTag;
}
