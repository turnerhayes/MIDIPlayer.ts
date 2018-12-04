#!/usr/bin/env node

import program from "commander";
import createDebug from "debug";
import mkdirp from "mkdirp";
import path from "path";
import ProgressBar from "progress";
import rimraf from "rimraf";
import { processSoundfont } from "soundfont2mp3";
import tmp from "tmp";

import Soundfont from "./soundfont";

// tslint:disable-next-line:no-var-requires
const packageInfo = require("./package.json");

interface IProcessNoteParameters {
  note: number;
  instrument: number;
  instrumentPath: string;
  stagingDir: string;
}

const debug = createDebug("soundfont-generator");
const soundfont2mp3Debug = createDebug("soundfont-generator:soundfont2mp3debug");

program
  .version(packageInfo.version, "-v, --version")
  .option("-s, --soundfont <soundfont>", "the soundfont file", null)
  .option("-d, --debug", "output more information")
  .parse(process.argv);

if (program.debug) {
  debug.enabled = true;
}

/// DEBUG
if (!program.soundfont) {
  program.soundfont = "/usr/share/sounds/sf2/FluidR3_GM.sf2";
}
/// END DEBUG

// tslint:disable-next-line:no-empty
const NO_OP = (): void => {};

let cleanupTempDir: () => void = NO_OP;

const tempDirPromise = new Promise<string>(
  (resolve, reject) => tmp.dir(
    {
      dir: __dirname,
      unsafeCleanup: true,
    },
    (err: any, dirPath: string, cleanupCallback: () => void) => {
      if (err) {
        reject(err);
        return;
      }

      cleanupTempDir = (): void => {
        debug(`Cleaning up directory ${dirPath}`);
        cleanupCallback();
        // Don't try to cleanup multiple times
        cleanupTempDir = NO_OP;
      };

      resolve(dirPath);
    },
  ),
);

tmp.setGracefulCleanup();

const soundfontFilePath = path.resolve(program.soundfont);

const maxNoteNumber = 255;

const promises: Array<Promise<any>> = [];

// let processingPromise = Promise.resolve();

const baseDir = path.resolve(__dirname, "sounds");

function processNote(
  {
    note,
    instrument,
    instrumentPath,
    stagingDir,
  }: IProcessNoteParameters,
): Promise<void> {
    const filePath = path.join(instrumentPath, `${note}.mp3`);

    debug("Processing note %s for instrument %s", note, instrument);

    return processSoundfont({
      debug: soundfont2mp3Debug,
      instrument,
      note,
      output: filePath,
      soundfont: soundfontFilePath,
      staging: stagingDir,
    });
}

new Promise(
  (resolve, reject) => rimraf(
    baseDir,
    (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    },
  ),
).then(
  () => Promise.all(
    [
      tempDirPromise,
      Soundfont.parse(soundfontFilePath),
    ],
  ),
).then(
  ([stagingDir, soundfont]: [string, Soundfont]) => {
    debug("Staging files in dir %s", stagingDir);
    const progressBar = new ProgressBar(
      "[:bar] (:percent)",
      {
        complete: "=",
        incomplete: " ",
        total: soundfont.presets.length * maxNoteNumber,
        width: 40,
      },
    );

    for (const preset of soundfont.presets) {
      const instrumentPath = path.join(baseDir, preset.MIDINumber.toString());

      // processingPromise = processingPromise.then(
      //   () => new Promise(
      //     (resolve, reject) => mkdirp(
      //       instrumentPath,
      //       (err) => {
      //         if (err) {
      //           reject(err);
      //           return;
      //         }

      //         resolve();
      //       },
      //     ),
      //   ),
      const mkdirPromise = new Promise(
        (resolve, reject) => mkdirp(
          instrumentPath,
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve();
          },
        ),
      );

      for (let note = 0; note <= maxNoteNumber; note++) {
        const promise = mkdirPromise.then(
          () => processNote({
            instrument: preset.MIDINumber,
            instrumentPath,
            note,
            stagingDir,
          }),
        ).then(
          () => progressBar.tick(),
        ).catch<[any]|undefined>(
          (err: any) => {
            progressBar.tick();

            if (!Array.isArray(err)) {
              err = [err];
            }

            err = err.filter(
              (error: any) => {
                // Generally just means it couldn't delete a temp file. Ignore.
                if (error.syscall === "unlink") {
                  return false;
                }

                return true;
              },
            );

            if (err.length > 0) {
              return Promise.reject(err);
            }
          },
        );

        promises.push(promise);
      }
    }
  },
).then(
  () => Promise.all(promises),
).then(
  () => debug("done."),
  // Workaround for spotty support for .finally()
).then(cleanupTempDir).catch(cleanupTempDir).catch(
  (err: any) => {
    if (!Array.isArray(err)) {
      err = [err];
    }

    err.forEach(
      (error: any) => {
        // tslint:disable-next-line:no-console
        console.error("ERROR: ", error);
      },
    );
  },
);
