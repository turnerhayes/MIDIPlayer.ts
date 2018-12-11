import { riffChunks } from "riff-chunks";

interface IWAVFileConstructorParameters {
  bitsPerSample: number;
  byteRate: number;
  channelCount: number;
  cues?: ICue[];
  sampleRate: number;
  samples: Int16Array;
}

interface ISamplesToTimeParameters {
  sampleCount: number;
  sampleRate: number;
}

interface IHeaderInfo {
  bitsPerSample: number;
  byteRate: number;
  channelCount: number;
  sampleRate: number;
}

export interface ICue {
  id: number;
  label?: string;
  sampleOffset: number;
  timeOffset: number;
}

interface ICueChunkData {
  id: number;
  playOrder: number;
  dataChunkID: string;
  chunkStart: number;
  blockStart: number;
  sampleOffset: number;
}

interface ICueLabelMap {
  cueID: number;
  label: string;
}

const enum ChunkIDs {
  format = "fmt ",
  data = "data",
  cue = "cue ",
  label = "labl",
}

export class WAVFile {
  public readonly bitsPerSample: number;

  public readonly byteRate: number;

  public readonly channelCount: number;

  public readonly cues: ICue[];

  public readonly duration: number;

  public readonly sampleRate: number;

  public readonly samples: Int16Array;

  constructor({
    bitsPerSample,
    byteRate,
    channelCount,
    sampleRate,
    samples,
    cues,
  }: IWAVFileConstructorParameters) {
    this.bitsPerSample = bitsPerSample;
    this.byteRate = byteRate;
    this.channelCount = channelCount;
    this.cues = cues || [];
    this.sampleRate = sampleRate;
    this.samples = samples;

    this.duration = samplesToTime({
      sampleCount: samples.length,
      sampleRate,
    });
  }

  public toJSON() {
    return {
      bitsPerSample: this.bitsPerSample,
      byteRate: this.byteRate,
      channelCount: this.channelCount,
      cues: this.cues,
      duration: this.duration,
      sampleCount: this.samples.length,
      sampleRate: this.sampleRate,
    };
  }
}

const stringFromDataView = (view: DataView, offset: number, length?: number): string => {
  return String.fromCharCode.apply(
    String,
    // The following hulabaloo is needed to quiet Typescript;
    // fromCharCode seems to be typed as accepting a rest array,
    // but Uint16Array is not an actual array of numbers. Since they don't have
    // sufficiently similar signatures, we can't simply cast it to number[],
    // we have to cast it to `unknown` first...
    (
      new Uint8Array(view.buffer, view.byteOffset + offset, length) as unknown
    ) as number[],
  );
};

const samplesToTime = ({
  sampleCount,
  sampleRate,
}: ISamplesToTimeParameters) => {
  return sampleCount / sampleRate;
};

const parseFormatChunk = (chunkData: DataView): IHeaderInfo => {
  // first 2 bytes are the compression code; for now, we only support
  // uncompressed PCM
  let offset = 2;

  const channelCount = chunkData.getUint16(offset, true);
  offset += 2;

  const sampleRate = chunkData.getUint32(offset, true);
  offset += 4;

  const byteRate = chunkData.getUint32(offset, true);
  offset += 4;

  // Next 2 bytes is block align--skip for now
  offset += 2;

  const bitsPerSample = chunkData.getUint16(offset, true);
  offset += 2;

  // after this are extra formatting bytes for compressed formats

  return {
    bitsPerSample,
    byteRate,
    channelCount,
    sampleRate,
  };
};

const parseCueChunk = (chunkData: DataView): ICueChunkData[] => {
  const numCuePoints: number = chunkData.getUint32(0, true);
  let offset = 4;

  const cues: ICueChunkData[] = [];

  while (offset < chunkData.byteLength) {
    const cueID = chunkData.getUint32(offset, true);
    offset += 4;

    const playOrder = chunkData.getUint32(offset, true);
    offset += 4;

    const dataChunkID = stringFromDataView(chunkData, offset, 4);
    offset += 4;

    const chunkStart = chunkData.getUint32(offset, true);
    offset += 4;

    const blockStart = chunkData.getUint32(offset, true);
    offset += 4;

    const sampleOffset = chunkData.getUint32(offset, true);
    offset += 4;

    cues.push({
      blockStart,
      chunkStart,
      dataChunkID,
      id: cueID,
      playOrder,
      sampleOffset,
    });
  }

  if (cues.length !== numCuePoints) {
    throw new Error(`Incorrect number of cue points; expected ${numCuePoints}, got ${cues.length}`);
  }

  return cues;
};

const parseCueLabelChunk = (chunkData: DataView): ICueLabelMap => {
  const cueID: number = chunkData.getUint32(0, true);

  const offset = 4;

  const label: string = stringFromDataView(chunkData, 4, chunkData.byteLength - offset).replace(/\0+$/, "");

  return {
    cueID,
    label,
  };
};

export default function parse(wavFile: Buffer|ArrayBufferLike): WAVFile {
  if (wavFile instanceof Buffer) {
    wavFile = wavFile.buffer.slice(
      wavFile.byteOffset,
      wavFile.byteOffset + wavFile.byteLength,
    );
  }

  const chunks = riffChunks(new Uint8Array(wavFile)) as IListChunk;

  const headerChunks = chunks.subChunks.filter(
    (chunk: IChunk): boolean => {
      return chunk.chunkId === ChunkIDs.format;
    },
  );

  if (!headerChunks || headerChunks.length === 0) {
    throw new Error("No header ('fmt ') chunks");
  }

  if (headerChunks.length === 0) {
    throw new Error("Multiple header ('fmt ') chunks");
  }

  const headerChunk = headerChunks[0] as IDataChunk;

  const header: IHeaderInfo = parseFormatChunk(
    new DataView(
      (wavFile as ArrayBuffer),
      headerChunk.chunkData.start,
      headerChunk.chunkSize,
    ),
  );

  let samples: Int16Array|undefined;

  let cueChunkData: ICueChunkData[] = [];

  const cueLabels: { [cueID: number]: string } = {};

  chunks.subChunks.forEach(
    (chunk: IChunk): void => {
      if (chunk.chunkId === ChunkIDs.data) {
        samples = new Int16Array(
          (wavFile as ArrayBuffer),
          (chunk as IDataChunk).chunkData.start,
          chunk.chunkSize / Int16Array.BYTES_PER_ELEMENT,
        );
      } else if (chunk.chunkId === ChunkIDs.cue) {
        cueChunkData = parseCueChunk(
          new DataView(
            (wavFile as ArrayBuffer),
            (chunk as IDataChunk).chunkData.start,
            chunk.chunkSize,
          ),
        );
      } else if (chunk.chunkId.toUpperCase() === "LIST") {
        (chunk as IListChunk).subChunks.forEach(
          (subChunk: IChunk) => {
            if (subChunk.chunkId === ChunkIDs.label) {
              const { cueID, label } = parseCueLabelChunk(
                new DataView(
                  (wavFile as ArrayBuffer),
                  (subChunk as IDataChunk).chunkData.start,
                  subChunk.chunkSize,
                ),
              );

              cueLabels[cueID] = label;
            }
          },
        );
      }
    },
  );

  if (!samples) {
    throw new Error("No sample data found");
  }

  return new WAVFile({
    bitsPerSample: header.bitsPerSample,
    byteRate: header.byteRate,
    channelCount: header.channelCount,
    cues: cueChunkData.map(
      (data: ICueChunkData) => ({
        id: data.id,
        label: cueLabels[data.id],
        sampleOffset: data.sampleOffset,
        timeOffset: samplesToTime({
          sampleCount: data.sampleOffset,
          sampleRate: header.sampleRate,
        }),
      }),
    ),
    sampleRate: header.sampleRate,
    samples,
  });
}
