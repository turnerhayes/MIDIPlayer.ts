import createDebug from "debug";
import fs from "fs";
import lamejs from "lamejs";
import mkdirp from "mkdirp";
import path from "path";

import getWavFile from "./get-wav-file";
import Soundfont from "./soundfont";
import Instrument from "./soundfont-parser/instrument";
import IPreset from "./soundfont-parser/IPreset";
import Sample from "./soundfont-parser/sample";
import SampleLinkTypes from "./soundfont-parser/sample-link-types";

const debug = createDebug("soundfont:get-sample");

/// DEBUG

// const sfpath = "./OmegaGMGS2.sf2";
const sfpath = "/usr/share/sounds/sf2/FluidR3_GM.sf2";

/// END DEBUG

const basePath = path.join(__dirname, "rendered-samples");

function getSampleDirectoryPath(preset: IPreset): string {
  const dirPath = path.join(basePath, preset.name);

  return dirPath;
}

const getSampleWavPath = (
  preset: IPreset,
  sample: Sample,
): string => {
  return path.resolve(getSampleDirectoryPath(preset), `${sample.name}.wav`);
};

function createSampleDirectory(preset: IPreset): Promise<string> {
  const dirPath = getSampleDirectoryPath(preset);
  debug("creating sample directory " + dirPath);

  return new Promise<string>(
    (resolve, reject) => mkdirp(
      dirPath,
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(dirPath);
      },
    ),
  );
}

const mergeRanges = (
  ranges: Array<[number, number]|undefined>,
): [number, number] | undefined => {
  let finalRange: [number, number]|undefined;

  for (const range of ranges) {
    // undefined range === all values
    if (range === undefined) {
      return undefined;
    }

    if (!finalRange) {
      finalRange = range;
    } else {
      if (range[0] < finalRange[0]) {
        finalRange[0] = range[0];
      }

      if (range[1] > finalRange[1]) {
        finalRange[1] = range[1];
      }
    }
  }

  return finalRange;
};

const getSampleID = (
  presetNumber: number,
  instrumentIndex: number,
  sampleIndex: number,
): string => {
  return `${presetNumber}.${instrumentIndex}.${sampleIndex}`;
};

const writeSampleSummaryFile = (soundfont: Soundfont): Promise<void> => {
  interface ISampleInfo {
    instrumentIndex?: number;
    instrumentName?: string;
    originalPitch: number;
    path: string;
    pan?: number;
    sampleIndex: number;
    sampleLinkType: string;
    sampleLinkIndex: number;
  }

  const summaryData: {
    presets: {
      [presetID: number]: {
        keys: {
          [keys: string]: {
            [velocities: string]: ISampleInfo[],
          },
        },
        samples?: {
          [sampleID: string]: ISampleInfo,
        },
        samplesByOriginalPitch: {
          [originalPitch: number]: ISampleInfo[],
        },
        keyMap?: {
          [keys: string]: string[],
        },
        name: string,
        velocityMap?: {
          [velocities: string]: string[],
        },
      },
    },
  } = {
    presets: {},
  };

  soundfont.presets.forEach(
    (preset) => {
      const samples = {};

      const keyRanges: Array<[number, number]|undefined> = [];
      const velocityRanges: Array<[number, number]|undefined> = [];

      const sampleInfo: {
        [sampleID: string]: ISampleInfo,
      } = {};

      const keyMap: {
        [keys: string]: string[],
      } = {};

      const velocityMap: {
        [velocities: string]: string[],
      } = {};

      const keys: {
        [keys: string]: {
          [velocities: string]: ISampleInfo[],
        },
      } = {};

      const samplesByOriginalPitch: {
        [originalPitch: number]: ISampleInfo[],
      } = {};

      preset.instruments.forEach(
        // tslint:disable-next-line:no-shadowed-variable
        ({ instrument, keyRange, velocityRange }, instrumentIndex) => {
          const keyString = keyRange === undefined ?
            "*" :
            `${keyRange[0]}-${keyRange[1]}`;

          const velocityString = velocityRange === undefined ?
            "*" :
            `${velocityRange[0]}-${velocityRange[1]}`;

          keyMap[keyString] = [];
          velocityMap[velocityString] = [];

          if (!keys[keyString]) {
            keys[keyString] = {};
          }

          if (!keys[keyString][velocityString]) {
            keys[keyString][velocityString] = [];
          }

          instrument.samples.forEach(
            ({ sample, pan }, sampleIndex) => {
              const samplePath = path.relative(__dirname, getSampleWavPath(preset, sample));
              const sampleID = getSampleID(preset.MIDINumber, instrumentIndex, sampleIndex);
              const sampleInfoItem: ISampleInfo = {
                instrumentIndex,
                instrumentName: instrument.name,
                originalPitch: sample.originalPitch,
                pan,
                path: samplePath,
                sampleIndex: sample.sampleIndex,
                sampleLinkIndex: sample.sampleLinkIndex,
                sampleLinkType: SampleLinkTypes[sample.sampleLinkType],
              };

              keys[keyString][velocityString].push(sampleInfoItem);

              if (!samplesByOriginalPitch[sample.originalPitch]) {
                samplesByOriginalPitch[sample.originalPitch] = [];
              }

              samplesByOriginalPitch[sample.originalPitch].push(sampleInfoItem);

              sampleInfo[sampleID] = sampleInfoItem;

              keyMap[keyString].push(sampleID);
              velocityMap[velocityString].push(sampleID);
            },
          );
        },
      );

      const velocityRange = mergeRanges(velocityRanges);

      summaryData.presets[preset.MIDINumber] = {
        // keyMap,
        keys,
        name: preset.name,
        // samples: sampleInfo,
        samplesByOriginalPitch,
        // velocityMap,
      };
    },
  );

  return new Promise<void>(
    (resolve, reject) => fs.writeFile(
      path.join(basePath, "font-summary.json"),
      JSON.stringify(summaryData, null, "  "),
      (err) => {
        if (err) {
          return reject(err);
        }

        return resolve();
      },
    ),
  );
};

const writeSampleMetadata = (
  {
    preset,
    instrument,
    sample,
    sampleParameters,
  }: {
    preset: IPreset,
    instrument: Instrument,
    sample: Sample,
    sampleParameters: {
      pan: number|undefined,
    },
  },
): Promise<string> => {
  const filePath = path.resolve(getSampleDirectoryPath(preset), `${sample.name}.metadata.json`);

  const data = JSON.stringify({
    loopRange: sample.loopRange,
    originalPitch: sample.originalPitch,
    pan: sampleParameters.pan,
    pitchCorrection: sample.pitchCorrection,
    sampleRate: sample.sampleRate,
  });

  debug("Writing metadata file " + filePath);

  return new Promise<string>(
    (resolve, reject) => fs.writeFile(
      filePath,
      data,
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(filePath);
      },
    ),
  );
};

const writeWavFile = (sampleData: DataView, preset: IPreset, sample: Sample): Promise<string> => {
  const sampleWavOutPath = getSampleWavPath(preset, sample);

  return new Promise<string>(
    (resolve, reject) => fs.writeFile(
      sampleWavOutPath,
      Buffer.from(getWavFile(sampleData, sample)),
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(sampleWavOutPath);
      },
    ),
  );
};

const writeMP3File = (sampleData: Buffer, preset: IPreset, sample: Sample): Promise<string> => {
  const sampleMP3OutPath = path.resolve(getSampleDirectoryPath(preset), `${sample.name}.mp3`);

  const encoder = new lamejs.Mp3Encoder(1, sample.sampleRate, 128);

  const samples = new Int16Array(sampleData);

  // const encoded = new Int8Array(encoder.encodeBuffer(samples));

  // const remainder = new Int8Array(encoder.flush());

  // const buffer = [...encoded];

  // if (remainder.length > 0) {
  //   buffer.push(...remainder);
  // }

  const buffer: Int8Array[] = [];

  let remaining = samples.length;
  const maxSamples = 1152;
  for (let i = 0; remaining >= maxSamples; i += maxSamples) {
    const mono = samples.subarray(i, i + maxSamples);
    const mp3buf = encoder.encodeBuffer(mono);
    if (mp3buf.length > 0) {
      buffer.push(new Int8Array(mp3buf));
    }
    remaining -= maxSamples;
  }
  const d = encoder.flush();
  if (d.length > 0) {
    buffer.push(new Int8Array(d));
  }

  debug("writing MP3 file " + sampleMP3OutPath);

  return new Promise<string>(
    (resolve, reject) => fs.writeFile(
      sampleMP3OutPath,
      buffer,
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(sampleMP3OutPath);
      },
    ),
  );
};

const convertedSamples: any = {};

Soundfont.parse(sfpath).then(
  (sf) => {
    /// DEBUG
    return writeSampleSummaryFile(sf).then(
      () => ([]),
    );
    /// END DEBUG

    const promises: Array<Promise<any>> = [];

    sf.presets.forEach(
      (preset) => {
        const mkdirPromise = createSampleDirectory(preset);

        // preset.instruments.filter((i) => i.instrument.name === "Saw/GS").forEach(
        // preset.instruments.slice(0, 1).forEach(
        preset.instruments.forEach(
          ({ instrument, keyRange, velocityRange }) => {
            // instrument.samples.filter((s) => s.sample.name === "Sawtooth Wave A1").forEach(
            // instrument.samples.slice(0, 1).forEach(
            instrument.samples.forEach(
              ({ sample, ...sampleParameters }) => {
                const metadataPromise = mkdirPromise.then(
                  () => writeSampleMetadata({
                    instrument,
                    preset,
                    sample,
                    sampleParameters,
                  }),
                );

                const wavPromise = mkdirPromise.then(
                  () => writeWavFile(sample.data, preset, sample),
                );

                promises.push(
                  metadataPromise,
                  wavPromise,
                );

                promises.push(
                  Promise.all([
                    metadataPromise,
                    wavPromise,
                  ]).then(
                    ([ metadataPath, wavPath ]) => {
                      convertedSamples[sample.name] = {
                        metadata: path.relative(__dirname, metadataPath),
                        wav: path.relative(__dirname, wavPath),
                      };
                    },
                  ),
                );
              },
            );
          },
        );
      },
    );

    return Promise.all(promises);
  },
).then(
  () => {
    const summaryPath = path.join(basePath, "samples.json");

    return new Promise<void>(
      (resolve, reject) => fs.writeFile(
        summaryPath,
        JSON.stringify(convertedSamples, null, "  "),
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          resolve();
        },
      ),
    );
  },
).catch(
  (err) => {
    // tslint:disable-next-line:no-console
    console.error(err);
  },
);
