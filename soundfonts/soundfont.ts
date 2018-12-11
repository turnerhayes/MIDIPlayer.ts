import fs from "fs";
import { findChunk, riffChunks } from "riff-chunks";

import GeneratorTypes from "./soundfont-parser/generator-types";
import GeneratorValue from "./soundfont-parser/generator-value";
import IInstrumentSample from "./soundfont-parser/IInstrumentSample";
import Instrument from "./soundfont-parser/instrument";
import IPreset from "./soundfont-parser/IPreset";
import IPresetInstrument from "./soundfont-parser/IPresetInstrument";
import ModulatorTypes from "./soundfont-parser/modulator-types";
import IGeneratorInfo from "./soundfont-parser/parser-interfaces/IGeneratorInfo";
import IInstrumentHeader from "./soundfont-parser/parser-interfaces/IInstrumentHeader";
import IModulatorInfo from "./soundfont-parser/parser-interfaces/IModulatorInfo";
import IPresetHeader from "./soundfont-parser/parser-interfaces/IPresetHeader";
import ISampleHeader from "./soundfont-parser/parser-interfaces/ISampleHeader";
import ISoundfontHeaderInfo from "./soundfont-parser/parser-interfaces/ISoundfontHeaderInfo";
import IVersionTag from "./soundfont-parser/parser-interfaces/IVersionTag";
import Sample from "./soundfont-parser/sample";
import SampleLinkTypes from "./soundfont-parser/sample-link-types";
import SoundfontParseError from "./soundfont-parser/soundfont-parse-error";
import TransformTypes from "./soundfont-parser/transform-types";

type Bags = Array<{
  generatorIndex: number;
  modulatorIndex: number;
}>;

export interface ISoundfontConstructorParameters {
  file: Buffer;
  header: ISoundfontHeaderInfo;
  presets: IPreset[];
  instruments: Instrument[];
  sampleHeaders: ISampleHeader[];
}

const readString = (file: Buffer, chunk: IDataChunk, start?: number) => {
  if (start === undefined) {
    start = chunk.chunkData.start;
  }

  return file.toString(
    "ascii",
    start,
    // Find first null byte index
    file.indexOf(0, start),
  );
};

function readChunkIntoString(file: Buffer, chunk: IDataChunk|null): string {
  if (!chunk) {
    return "";
  }

  return readString(file, chunk);
}

function readVersionTag(file: Buffer, chunk: IDataChunk|null): IVersionTag|null {
  if (!chunk) {
    return null;
  }

  return {
    major: file.readUInt16LE(chunk.chunkData.start),
    minor: file.readUInt16LE(chunk.chunkData.start + 2),
  };
}

function readHeaderInfo(file: Buffer, infoChunk: IListChunk): ISoundfontHeaderInfo {
  const versionTag = readVersionTag(file, findChunk(infoChunk.subChunks, "ifil") as IDataChunk);

  if (!versionTag) {
    throw new SoundfontParseError("Soundfont file does not contain any file version information");
  }

  const bankName = readChunkIntoString(file, findChunk(infoChunk.subChunks, "INAM") as IDataChunk);

  const soundEngine = readChunkIntoString(file, findChunk(infoChunk.subChunks, "isng") as IDataChunk);

  const wavetableROM = readChunkIntoString(file, findChunk(infoChunk.subChunks, "irom") as IDataChunk|null);

  const wavetableRevision = readVersionTag(file, findChunk(infoChunk.subChunks, "iver") as IDataChunk|null);

  const creationDate = readChunkIntoString(file, findChunk(infoChunk.subChunks, "ICRD") as IDataChunk|null);

  const engineers = readChunkIntoString(file, findChunk(infoChunk.subChunks, "IENG") as IDataChunk|null);

  const product = readChunkIntoString(file, findChunk(infoChunk.subChunks, "IPRD") as IDataChunk|null);

  const copyright = readChunkIntoString(file, findChunk(infoChunk.subChunks, "ICOP") as IDataChunk|null);

  const comments = readChunkIntoString(file, findChunk(infoChunk.subChunks, "ICMT") as IDataChunk|null);

  const soundfontTools = readChunkIntoString(file, findChunk(infoChunk.subChunks, "ISFT") as IDataChunk|null);

  return {
    bankName,
    comments,
    copyright,
    creationDate,
    engineers,
    product,
    soundEngine,
    soundfontTools,
    version: versionTag,
    wavetableROM,
    wavetableRevision,
  };
}

function readInstrumentHeaders(file: Buffer, presetDataChunk: IListChunk): IInstrumentHeader[] {
  const headers: IInstrumentHeader[] = [];

  const chunk = findChunk(presetDataChunk.subChunks, "inst") as IDataChunk|null;

  if (!chunk) {
    throw new SoundfontParseError("File invalid: mandatory `inst` chunk missing");
  }

  let offset = chunk.chunkData.start;

  while (offset < chunk.chunkData.end) {
    const name = readString(file, chunk, offset);
    offset += 20;
    const instrumentBagIndex = file.readUInt16LE(offset);
    offset += 2;

    headers.push({
      index: headers.length,
      instrumentBagIndex,
      name,
    });
  }

  return headers;
}

function readPresetHeaders(file: Buffer, presetDataChunk: IListChunk): IPresetHeader[] {
  const headerChunk = findChunk(presetDataChunk.subChunks, "phdr") as IDataChunk;

  let offset = headerChunk.chunkData.start;

  const headers = [];

  while (offset < headerChunk.chunkData.end) {
    const presetName = readString(file, headerChunk, offset);
    offset += 20;
    const presetNumber = file.readUInt16LE(offset);
    offset += 2;
    const bankNumber = file.readUInt16LE(offset);
    offset += 2;
    const presetBagIndex = file.readUInt16LE(offset);
    offset += 2;
    const library = file.readUInt32LE(offset);
    offset += 4;
    const genre = file.readUInt32LE(offset);
    offset += 4;
    const morphology = file.readUInt32LE(offset);
    offset += 4;

    headers.push({
      bankNumber,
      genre,
      index: headers.length,
      library,
      morphology,
      presetBagIndex,
      presetName,
      presetNumber,
    });
  }

  return headers;
}

function readBags(file: Buffer, chunk: IDataChunk): Bags {
  let offset = chunk.chunkData.start;

  const indices = [];

  while (offset < chunk.chunkData.end) {
    const generatorIndex = file.readUInt16LE(offset);
    offset += 2;

    const modulatorIndex = file.readUInt16LE(offset);
    offset += 2;

    indices.push({
      generatorIndex,
      modulatorIndex,
    });
  }

  return indices;
}

function readGenerators(file: Buffer, chunk: IDataChunk): IGeneratorInfo[] {
  let offset = chunk.chunkData.start;

  const generators = [];

  while (offset < chunk.chunkData.end) {
    const generatorType = file.readUInt16LE(offset);

    if (!GeneratorTypes[generatorType]) {
      throw new SoundfontParseError(`No generator type found for value ${generatorType}`);
    }

    offset += 2;

    const value = new GeneratorValue(file.readUInt16LE(offset));

    offset += 2; // 1 byte + 1 byte

    generators.push({
      generatorType,
      index: generators.length,
      value,
    });
  }

  return generators;
}

function readModulators(file: Buffer, chunk: IDataChunk): IModulatorInfo[] {
  let offset = chunk.chunkData.start;

  const modulators = [];

  while (offset < chunk.chunkData.end) {
    const sourceOperator = ModulatorTypes[file.readUInt16LE(offset)];
    offset += 2;
    const destinationOperator = GeneratorTypes[file.readUInt16LE(offset)];
    offset += 2;
    const amount = file.readInt16LE(offset);
    offset += 2;
    const amountSourceOperator = ModulatorTypes[file.readUInt16LE(offset)];
    offset += 2;
    const transformOperator = TransformTypes[file.readUInt16LE(offset)];
    offset += 2;

    modulators.push({
      amount,
      amountSourceOperator,
      destinationOperator,
      index: modulators.length,
      sourceOperator,
      transformOperator,
    });
  }

  return modulators;
}

const readSampleHeaders = (file: Buffer, chunk: IDataChunk): ISampleHeader[] => {
  let offset = chunk.chunkData.start;

  const headers = [];

  while (offset < chunk.chunkData.end) {
    const sampleName = readString(file, chunk, offset);
    offset += 20;

    const start = file.readUInt32LE(offset);
    offset += 4;

    const end = file.readUInt32LE(offset);
    offset += 4;

    const loopStart = file.readUInt32LE(offset);
    offset += 4;

    const loopEnd = file.readUInt32LE(offset);
    offset += 4;

    const sampleRate = file.readUInt32LE(offset);
    offset += 4;

    const originalPitch = file.readUInt8(offset);
    offset += 1;

    const pitchCorrection = file.readInt8(offset);
    offset += 1;

    const sampleLink = file.readUInt16LE(offset);
    offset += 2;

    const sampleLinkType = file.readUInt16LE(offset);
    offset += 2;

    headers.push({
      end,
      loopEnd,
      loopStart,
      originalPitch,
      pitchCorrection,
      sampleLink,
      sampleLinkType,
      sampleName,
      sampleRate,
      start,
    });
  }

  return headers;
};

export default class Soundfont {
  public static parse(fileSpec: Buffer|string): Promise<Soundfont> {
    let readPromise: Promise<Buffer>;

    if (typeof fileSpec === "string") {
      readPromise = new Promise<Buffer>(
        (resolve, reject) => fs.readFile(
          fileSpec,
          (err, fileBuffer) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(fileBuffer);
          },
        ),
      );
    } else {
      readPromise = Promise.resolve(fileSpec);
    }

    return readPromise.then(
      (file: Buffer) => {
        const fileChunks = riffChunks(file) as IListChunk;

        const infoChunk = fileChunks.subChunks.find(
          (chunk: IChunk) => (chunk as IListChunk).format === "INFO",
        ) as IListChunk;

        const header = readHeaderInfo(file, infoChunk);

        const sampleDataListChunk = infoChunk.subChunks.find(
          (chunk: IChunk) => {
            return (chunk as IListChunk).format === "sdta";
        }) as IListChunk;

        const sampleDataChunk = findChunk(sampleDataListChunk.subChunks, "smpl") as IDataChunk;

        const presetDataChunk = sampleDataListChunk.subChunks.find(
          (chunk: IChunk) => {
            return (chunk as IListChunk).format === "pdta";
          },
        ) as IListChunk;

        const instrumentHeaders = readInstrumentHeaders(file, presetDataChunk);

        const instrumentBags = readBags(file, findChunk(presetDataChunk.subChunks, "ibag") as IDataChunk);

        const instrumentGenerators = readGenerators(file, findChunk(presetDataChunk.subChunks, "igen") as IDataChunk);

        const instrumentModulators = readModulators(file, findChunk(presetDataChunk.subChunks, "imod") as IDataChunk);

        const presetHeaders = readPresetHeaders(file, presetDataChunk);

        const presetBags = readBags(file, findChunk(presetDataChunk.subChunks, "pbag") as IDataChunk);

        const presetGenerators = readGenerators(file, findChunk(presetDataChunk.subChunks, "pgen") as IDataChunk);

        const presetModulators = readModulators(file, findChunk(presetDataChunk.subChunks, "pmod") as IDataChunk);

        const sampleHeaders = readSampleHeaders(file, findChunk(presetDataChunk.subChunks, "shdr") as IDataChunk);

        const instruments: Instrument[] = [];

        const presets: IPreset[] = [];

        const allSamples: Sample[] = [];

        sampleHeaders.forEach(
          (sampleHeader) => {
            allSamples.push(
              new Sample({
                data: new DataView(
                  file.buffer,
                  // Need to multiply offsets by 2 because start and end are
                  // in sample points, and each sample is 16 bits (2 bytes)
                  // NOTE: This parser doesn't account for 24 bit samples.
                  sampleDataChunk.chunkData.start + (sampleHeader.start * 2),
                  (sampleHeader.end * 2) - (sampleHeader.start * 2),
                ),
                dataOffset: sampleDataChunk.chunkData.start,
                file,
                header: sampleHeader,
              }),
            );
          },
        );

        instrumentHeaders.forEach(
          (instrumentHeader, headerIndex) => {
            const startIndex = instrumentHeader.instrumentBagIndex;
            let endIndex;

            if (headerIndex < instrumentHeaders.length - 1) {
              endIndex = instrumentHeaders[headerIndex + 1].instrumentBagIndex;
            }

            const zones = [];

            const bags = instrumentBags.slice(startIndex, endIndex);
            const nextBag = endIndex === undefined ?
              undefined :
              instrumentBags[endIndex];

            const instrumentSampleHeaders: ISampleHeader[] = [];

            const instrumentSamples: IInstrumentSample[] = [];

            bags.forEach(
              (bag, bagIndex) => {
                const startGeneratorIndex = bag.generatorIndex;
                const startModulatorIndex = bag.modulatorIndex;

                let endGeneratorIndex;
                let endModulatorIndex;

                if (bagIndex < bags.length - 1) {
                  endGeneratorIndex = bags[bagIndex + 1].generatorIndex;
                  endModulatorIndex = bags[bagIndex + 1].modulatorIndex;
                } else if (nextBag) {
                  endGeneratorIndex = nextBag.generatorIndex;
                  endModulatorIndex = nextBag.modulatorIndex;
                }

                const generators = instrumentGenerators.slice(startGeneratorIndex, endGeneratorIndex);
                const modulators = instrumentModulators.slice(startModulatorIndex, endModulatorIndex);

                let pan: number|undefined;
                let sampleIndex: number|undefined;
                generators.forEach(
                  (generator) => {
                    if (generator.generatorType === GeneratorTypes.sampleID) {
                      sampleIndex = generator.value.unsignedValue;

                      if (!allSamples[sampleIndex]) {
                        throw new SoundfontParseError(
                          `Instrument ${
                            instrumentHeader.name
                          } refers to non-existent sample index ${
                            sampleIndex
                          }`,
                        );
                      }
                    } else if (generator.generatorType === GeneratorTypes.pan) {
                      pan = generator.value.signedValue;
                    }
                  },
                );

                if (sampleIndex) {
                  instrumentSamples.push({
                    pan,
                    sample: allSamples[sampleIndex],
                  });
                }
              },
            );

            const instrument = new Instrument({
              name: instrumentHeader.name,
              samples: instrumentSamples,
            });

            instruments.push(instrument);
          },
        );

        presetHeaders.forEach(
          (presetHeader, headerIndex) => {
            const startIndex = presetHeader.presetBagIndex;
            let endIndex;

            if (headerIndex < presetHeaders.length - 1) {
              endIndex = presetHeaders[headerIndex + 1].presetBagIndex;
            }

            const zones = [];

            const bags = presetBags.slice(startIndex, endIndex);
            const nextBag = endIndex === undefined ?
              undefined :
              presetBags[endIndex];

            const presetInstruments: IPresetInstrument[] = [];

            bags.forEach(
              (bag, bagIndex) => {
                const startGeneratorIndex = bag.generatorIndex;
                const startModulatorIndex = bag.modulatorIndex;

                let endGeneratorIndex;
                let endModulatorIndex;

                if (bagIndex < bags.length - 1) {
                  endGeneratorIndex = bags[bagIndex + 1].generatorIndex;
                  endModulatorIndex = bags[bagIndex + 1].modulatorIndex;
                } else if (nextBag) {
                  endGeneratorIndex = nextBag.generatorIndex;
                  endModulatorIndex = nextBag.modulatorIndex;
                }

                const generators = presetGenerators.slice(startGeneratorIndex, endGeneratorIndex);
                const modulators = presetModulators.slice(startModulatorIndex, endModulatorIndex);

                let keyRange: [number, number]|undefined;
                let velocityRange: [number, number]|undefined;
                let instrument: Instrument|undefined;

                generators.forEach(
                  (generatorInfo) => {
                    if (generatorInfo.generatorType === GeneratorTypes.keyRange) {
                      keyRange = generatorInfo.value.range;
                    } else if (generatorInfo.generatorType === GeneratorTypes.velRange) {
                      velocityRange = generatorInfo.value.range;
                    } else if (generatorInfo.generatorType === GeneratorTypes.instrument) {
                      const instrumentIndex = generatorInfo.value.unsignedValue;

                      if (!instruments[instrumentIndex]) {
                        throw new SoundfontParseError(`No instrument found at index ${instrumentIndex}`);
                      }

                      instrument = instruments[instrumentIndex];
                    }
                  },
                );

                if (instrument) {
                  presetInstruments.push({
                    instrument,
                    keyRange,
                    velocityRange,
                  });
                }
              },
            );

            presets.push({
              MIDINumber: presetHeader.presetNumber,
              instruments: presetInstruments,
              name: presetHeader.presetName,
            });
          },
        );

        return new Soundfont({
          file,
          header,
          instruments,
          presets,
          sampleHeaders,
        });
      },
    );
  }

  public file: Buffer;

  public header: ISoundfontHeaderInfo;

  public instruments: Instrument[];

  public presets: IPreset[];

  public sampleHeaders: ISampleHeader[];

  constructor(
    {
      file,
      header,
      instruments,
      presets,
      sampleHeaders,
    }: ISoundfontConstructorParameters,
  ) {
    this.file = file;
    this.header = header;
    this.instruments = instruments;
    this.presets = presets;
    this.sampleHeaders = sampleHeaders;
  }

  public toString() {
    const optionalFields: string[] = [];

    if (this.header.copyright) {
      optionalFields.push(`Copyright © ${this.header.copyright}`);
    }

    if (this.header.creationDate) {
      optionalFields.push(`Created ${this.header.creationDate}`);
    }

    if (this.header.engineers) {
      optionalFields.push(`Engineers: ${this.header.engineers}`);
    }

    if (this.header.product) {
      optionalFields.push(`Product: ${this.header.product}`);
    }

    if (this.header.wavetableROM) {
      optionalFields.push(`Wavetable ROM: ${this.header.wavetableROM}${
        this.header.wavetableRevision ?
          " v" + this.header.wavetableRevision.major + "." + this.header.wavetableRevision.minor :
          ""
      }`);
    }

    if (this.header.soundfontTools) {
      optionalFields.push(`Tools used: ${this.header.soundfontTools}`);
    }

    if (this.header.comments) {
      optionalFields.push(this.header.comments);
    }

    return `Soundfont file:
  Bank name: ${this.header.bankName}
  Version ${this.header.version.major}.${this.header.version.minor}
  Optimized for ${this.header.soundEngine}${
    optionalFields.length > 0 ?
      "\n  " + optionalFields.join("\n  ") :
      ""
    }
  Contains:
    ${this.presets.length} presets
`;
  }
}
