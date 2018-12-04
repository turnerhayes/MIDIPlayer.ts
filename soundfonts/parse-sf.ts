/**
 * Coded using specification at http://www.synthfont.com/sfspec24.pdf
 */

import fs from "fs";
import { findChunk, riffChunks } from "riff-chunks";

import GeneratorTypes from "./generator-types";
import GeneratorValue from "./generator-value";
import ModulatorTypes from "./modulator-types";
import SampleLinkTypes from "./sample-link-types";
import TransformTypes from "./transform-types";

const sfpath = "/usr/share/sounds/sf2/FluidR3_GM.sf2";

type Bag = Array<{
  generatorIndex: number;
  modulatorIndex: number;
}>;

interface IVersionTag {
  major: number;
  minor: number;
}

interface IPresetHeader {
  bankNumber: number;
  genre: number;
  library: number;
  morphology: number;
  presetBagIndex: number;
  presetName: string;
  presetNumber: number;
  index: number;
}

interface IGeneratorInfo {
  generatorType: string;
  value: GeneratorValue;
  index: number;
}

interface IModulatorInfo {
  amount: number;
  amountSourceOperator: string;
  destinationOperator: string;
  sourceOperator: string;
  transformOperator: string;
  index: number;
}

interface IInstrumentInfo {
  instrumentBagIndex: number;
  name: string;
  index: number;
}

interface ISampleHeader {
  start: number;
  end: number;
  loopStart: number;
  loopEnd: number;
  originalPitch: number;
  pitchCorrection: number;
  sampleLink: number;
  sampleLinkType: string;
  sampleName: string;
  sampleRate: number;
}

interface IGeneratorZone {
  zoneIndex: number;
  generators: IGeneratorInfo[];
  instrumentID: number|undefined;
  keyRange: [number, number]|undefined;
}

interface IPreset {
  name: string;
  number: number;
  bank: number;
  generatorZones: IGeneratorZone[];
  modulators: IModulatorInfo[];
  instruments: Array<{
    instrument: IInstrument,
    keyRange: [number, number];
  }>;
}

interface IInstrument {
  name: string;
  // generators: IGeneratorInfo[];
  // modulators: IModulatorInfo[];
  keyRanges: Array<[number, number]>;
  sampleIDs: number[];
}

interface IFileInfo {
  bankName: string;
  copyright: string;
  comments: string;
  creationDate: string;
  engineers: string;
  file: Buffer;
  product: string;
  soundEngine: string;
  soundfontTools: string;
  wavetableROM: string;
  wavetableRevision: IVersionTag|null;
  versionTag: IVersionTag;
  presetHeaders: IPresetHeader[];
  presetGenerators: IGeneratorInfo[];
  presetModulators: IModulatorInfo[];
  presetBag: Bag;
  instruments: IInstrumentInfo[];
  instrumentGenerators: IGeneratorInfo[];
  instrumentModulators: IModulatorInfo[];
  instrumentBag: Bag;
  sampleHeaders: ISampleHeader[];
}

function generateInstruments(info: IFileInfo) {
  const instruments: IInstrument[] = [];

  info.instruments.forEach(
    (instrumentInfo: IInstrumentInfo, instrumentIndex) => {
      const instrumentBagStartIndex = instrumentInfo.instrumentBagIndex;

      let instrumentBagEndIndex: number|undefined;

      const instrumentZones = info.instrumentBag.slice(instrumentBagStartIndex, instrumentBagEndIndex);

      let nextBagGeneratorIndex: number;

      let nextBagModulatorIndex: number;

      if (instrumentIndex < info.instruments.length - 1) {
        const nextInstrument = info.instruments[instrumentIndex + 1];

        instrumentBagEndIndex = nextInstrument.instrumentBagIndex;
        nextBagGeneratorIndex = info.instrumentBag[instrumentBagEndIndex].generatorIndex;
        nextBagModulatorIndex = info.instrumentBag[instrumentBagEndIndex].modulatorIndex;
      }

      const modulators: IModulatorInfo[] = [];
      const generators: IGeneratorInfo[] = [];
      const sampleIDs: number[] = [];
      const keyRanges: Array<[number, number]> = [];

      instrumentZones.forEach(
        (zone, zoneIndex) => {
          const generatorStartIndex = zone.generatorIndex;
          const modulatorStartIndex = zone.modulatorIndex;

          let generatorEndIndex: number|undefined;
          let modulatorEndIndex: number|undefined;

          if (zoneIndex < instrumentZones.length - 1) {
            generatorEndIndex = instrumentZones[zoneIndex + 1].generatorIndex;
            modulatorEndIndex = instrumentZones[zoneIndex + 1].modulatorIndex;
          } else {
            generatorEndIndex = nextBagGeneratorIndex;
            modulatorEndIndex = nextBagModulatorIndex;
          }

          const zoneGenerators = info.instrumentGenerators.slice(
            generatorStartIndex,
            generatorEndIndex,
          );

          generators.push(
            ...zoneGenerators,
          );

          let keyRange: [number, number]|undefined;

          zoneGenerators.forEach(
            (generator) => {
              if (generator.generatorType === "keyRange") {
                keyRange = generator.value.range;
              }
              // if (generator.generatorType === "sampleID") {
              //   sampleIDs.push(generator.value.unsignedValue);
              // }
            },
          );

          if (keyRange) {
            keyRanges.push(keyRange);
          }

          modulators.push(
            ...info.instrumentModulators.slice(
              modulatorStartIndex,
              modulatorEndIndex,
            ),
          );
        },
      );

      instruments.push({
        // generators,
        // modulators,
        keyRanges,
        name: instrumentInfo.name,
        sampleIDs,
      });
    },
  );

  return instruments;
}

new Promise<Buffer>(
  (resolve, reject) => fs.readFile(
    sfpath,
    (err: any, file: Buffer): void => {
      if (err) {
        reject(err);
        return;
      }

      resolve(file);
    },
  ),
).then(
  (file: Buffer): IFileInfo => {
    const chunks = riffChunks(file) as IListChunk;

    const readString = (chunk: IDataChunk, start?: number) => {
      if (start === undefined) {
        start = chunk.chunkData.start;
      }

      return file.toString(
        "ascii",
        start,
        file.indexOf(0, start),
      );
    };

    const readChunkIntoString = (chunk: IDataChunk|null): string => {
      if (!chunk) {
        return "";
      }

      return readString(chunk);
    };

    const readVersionTag = (chunk: IDataChunk|null): IVersionTag|null => {
      if (!chunk) {
        return null;
      }

      return {
        major: file.readUInt16LE(chunk.chunkData.start),
        minor: file.readUInt16LE(chunk.chunkData.start + 2),
      };
    };

    const readPresetHeaders = (headerChunk: IDataChunk): IPresetHeader[] => {
      let offset = headerChunk.chunkData.start;

      const headers = [];

      while (offset < headerChunk.chunkData.end) {
        const presetName = readString(headerChunk, offset);
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

      // last element is not actually a header but a terminal record
      // headers.pop();

      return headers;
    };

    const readInstruments = (chunk: IDataChunk): IInstrumentInfo[] => {
      let offset = chunk.chunkData.start;

      const instrumentList = [];

      while (offset < chunk.chunkData.end) {
        const name = readString(chunk, offset);
        offset += 20;
        const instrumentBagIndex = file.readUInt16LE(offset);
        offset += 2;

        instrumentList.push({
          index: instrumentList.length,
          instrumentBagIndex,
          name,
        });
      }

      // Last record is not actually an instrument but a terminal record
      // instrumentList.pop();

      return instrumentList;
    };

    const readGenerators = (chunk: IDataChunk): IGeneratorInfo[] => {
      let offset = chunk.chunkData.start;

      const generators = [];

      while (offset < chunk.chunkData.end) {
        const generatorNumber = file.readUInt16LE(offset);
        const generatorType = GeneratorTypes[generatorNumber] as string;

        if (!generatorType) {
          throw new Error(`No generator type found for value ${generatorNumber}`);
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

      // Last record is just a terminal record
      // generators.pop();

      return generators;
    };

    const readModulators = (chunk: IDataChunk): IModulatorInfo[] => {
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

      // remove terminal record
      // modulators.pop();

      return modulators;
    };

    const readSampleHeaders = (chunk: IDataChunk): ISampleHeader[] => {
      let offset = chunk.chunkData.start;

      const headers = [];

      while (offset < chunk.chunkData.end) {
        const sampleName = readString(chunk, offset);
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

        const sampleLinkType = SampleLinkTypes[file.readUInt16LE(offset)] as string;
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

      // Remove terminal record
      // headers.pop();

      return headers;
    };

    const readBag = (chunk: IDataChunk): Bag => {
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

      // Remove terminal record index
      // indices.pop();

      return indices;
    };

    const infoChunk = chunks.subChunks.find(
      (chunk: IChunk) => (chunk as IListChunk).format === "INFO",
    ) as IListChunk;

    const versionTag = readVersionTag(findChunk(infoChunk.subChunks, "ifil") as IDataChunk);

    if (versionTag === null) {
      throw new Error("Soundfont contains no file version information");
    }

    const bankName = readChunkIntoString(findChunk(infoChunk.subChunks, "INAM") as IDataChunk);

    const soundEngine = readChunkIntoString(findChunk(infoChunk.subChunks, "isng") as IDataChunk);

    const wavetableROM = readChunkIntoString(findChunk(infoChunk.subChunks, "irom") as IDataChunk|null);

    const wavetableRevision = readVersionTag(findChunk(infoChunk.subChunks, "iver") as IDataChunk|null);

    const creationDate = readChunkIntoString(findChunk(infoChunk.subChunks, "ICRD") as IDataChunk|null);

    const engineers = readChunkIntoString(findChunk(infoChunk.subChunks, "IENG") as IDataChunk|null);

    const product = readChunkIntoString(findChunk(infoChunk.subChunks, "IPRD") as IDataChunk|null);

    const copyright = readChunkIntoString(findChunk(infoChunk.subChunks, "ICOP") as IDataChunk|null);

    const comments = readChunkIntoString(findChunk(infoChunk.subChunks, "ICMT") as IDataChunk);

    const soundfontTools = readChunkIntoString(findChunk(infoChunk.subChunks, "ISFT") as IDataChunk);

    const sampleDataChunk = infoChunk.subChunks.find(
      (chunk: IChunk) => {
        return (chunk as IListChunk).format === "sdta";
      }) as IListChunk;

    const pdataChunk = sampleDataChunk.subChunks.find(
      (chunk: IChunk) => {
        return (chunk as IListChunk).format === "pdta";
      },
    ) as IListChunk;

    const presetHeaders = readPresetHeaders(findChunk(pdataChunk.subChunks, "phdr") as IDataChunk);

    const instruments = readInstruments(findChunk(pdataChunk.subChunks, "inst") as IDataChunk);

    const instrumentGenerators = readGenerators(findChunk(pdataChunk.subChunks, "igen") as IDataChunk);

    const instrumentModulators = readModulators(findChunk(pdataChunk.subChunks, "imod") as IDataChunk);

    const presetGenerators = readGenerators(findChunk(pdataChunk.subChunks, "pgen") as IDataChunk);

    const presetModulators = readModulators(findChunk(pdataChunk.subChunks, "pmod") as IDataChunk);

    const sampleHeaders = readSampleHeaders(findChunk(pdataChunk.subChunks, "shdr") as IDataChunk);

    const instrumentBag = readBag(findChunk(pdataChunk.subChunks, "ibag") as IDataChunk);

    const presetBag = readBag(findChunk(pdataChunk.subChunks, "pbag") as IDataChunk);

    const info: IFileInfo = {
      bankName,
      comments,
      copyright,
      creationDate,
      engineers,
      file,
      instrumentBag,
      instrumentGenerators,
      instrumentModulators,
      instruments,
      presetBag,
      presetGenerators,
      presetHeaders,
      presetModulators,
      product,
      sampleHeaders,
      soundEngine,
      soundfontTools,
      versionTag,
      wavetableROM,
      wavetableRevision,
    };

    // fs.writeFileSync("./psf.json", JSON.stringify(info, null, "  "));

    return info;
  },
).then(
    (info: IFileInfo) => {
      const presets: IPreset[] = [];

      const instruments: IInstrument[] = generateInstruments(info);

      info.presetHeaders.forEach(
        (header, headerIndex) => {
          const preset: IPreset = {
            bank: header.bankNumber,
            generatorZones: [],
            instruments: [],
            modulators: [],
            name: header.presetName,
            number: header.presetNumber,
          };

          const presetBagStartIndex = header.presetBagIndex;

          let presetBagEndIndex: number|undefined;

          let nextBagGeneratorIndex: number;

          let nextBagModulatorIndex: number;

          if (headerIndex < info.presetHeaders.length - 1) {
            const nextPreset = info.presetHeaders[headerIndex + 1];

            presetBagEndIndex = nextPreset.presetBagIndex;
            nextBagGeneratorIndex = info.presetBag[presetBagEndIndex].generatorIndex;
            nextBagModulatorIndex = info.presetBag[presetBagEndIndex].modulatorIndex;
          }

          const presetZones = info.presetBag.slice(presetBagStartIndex, presetBagEndIndex);

          presetZones.forEach(
            (zone, zoneIndex) => {
              const generatorStartIndex = zone.generatorIndex;
              const modulatorStartIndex = zone.modulatorIndex;

              let generatorEndIndex: number|undefined;
              let modulatorEndIndex: number|undefined;

              if (zoneIndex < presetZones.length - 1) {
                generatorEndIndex = presetZones[zoneIndex + 1].generatorIndex;
                modulatorEndIndex = presetZones[zoneIndex + 1].modulatorIndex;
              } else {
                generatorEndIndex = nextBagGeneratorIndex;
                modulatorEndIndex = nextBagModulatorIndex;
              }

              const generators = info.presetGenerators.slice(
                generatorStartIndex,
                generatorEndIndex,
              );

              let instrumentID: number|undefined;

              generators.forEach(
                (generator) => {
                  if (generator.generatorType === "instrument") {
                    if (instrumentID !== undefined) {
                      throw new Error(
                        `Each zone should have only one instrument generator; zone ${zoneIndex} has multiple`,
                      );
                    }
                    instrumentID = generator.value.unsignedValue;
                    // preset.instruments[preset.instruments.length - 1].id = generator.value.unsignedValue;
                  }
                },
              );

              if (instrumentID !== undefined) {
                preset.instruments.push({
                  instrument: instruments[instrumentID],
                  keyRange: [-1, -1],
                });
              }

              // preset.generatorZones.push({
              //   generators,
              //   instrumentID,
              //   keyRange,
              //   zoneIndex,
              // });

              preset.modulators.push(...info.presetModulators.slice(modulatorStartIndex, modulatorEndIndex));
            },
          );

          presets.push(preset);
        },
      );

      const soundfont = {
        // instruments,
        presets,
      };

      fs.writeFileSync("./parse-out.json", JSON.stringify(soundfont, null, "  "));

      function mergeRanges(range1: [number, number], range2: [number, number]): [number, number] {
        const newRange: [number, number] = [range1[0], range1[1]];
        if (range2[0] < newRange[0]) {
          newRange[0] = range2[0];
        }

        if (range2[1] > newRange[1]) {
          newRange[1] = range2[1];
        }

        return newRange;
      }

      const presetData = presets.map(
        (preset) => {
          return {
            MIDINumber: preset.number,
            keyRange: preset.instruments.reduce(
              (range: [number, number]|undefined, instrument) => {
                if (range === undefined) {
                  return instrument.keyRange;
                }

                return mergeRanges(range, instrument.keyRange);
              },
              undefined,
            ),
            name: preset.name,
          };
        },
      );
      // console.log(
      //   JSON.stringify(
      //     null,
      //     "  ",
      //   ),
      // );

      return presetData;
  },
).catch(
  // tslint:disable-next-line:no-console
  (err: any) => console.error(err),
);
