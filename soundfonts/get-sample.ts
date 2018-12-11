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

const debug = createDebug("soundfont:get-sample");

/// DEBUG

const sfpath = "/usr/share/sounds/sf2/FluidR3_GM.sf2";

/// END DEBUG

const basePath = path.join(__dirname, "rendered-samples");

function getSampleDirectoryPath(preset: IPreset): string {
  const dirPath = path.join(basePath, preset.name);

  return dirPath;
}

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

function writeSampleMetadata(
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
): Promise<string> {
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
}

function writeWavFile(sampleData: DataView, preset: IPreset, sample: Sample): Promise<string> {
  const sampleWavOutPath = path.resolve(getSampleDirectoryPath(preset), `${sample.name}.wav`);

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
}

function writeMP3File(sampleData: Buffer, preset: IPreset, sample: Sample): Promise<string> {
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
}

const convertedSamples: any = {};

Soundfont.parse(sfpath).then(
  (sf) => {
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
