#!/usr/bin/env node

import { fork } from "child_process";
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

const handleUglyExit = () => {
  cleanupTempDir();
  process.exit(1);
};

process.on("SIGINT", handleUglyExit);

process.on("SIGTERM", handleUglyExit);

process.on("uncaughtException", handleUglyExit);

process.on("unhandledRejection", handleUglyExit);

const soundfontFilePath = path.resolve(program.soundfont);

// const maxNoteNumber = 2;
const maxNoteNumber = 255;

const promises: Array<Promise<any>> = [];

// let processingPromise = Promise.resolve();

const baseDir = path.resolve(__dirname, "sounds");

function processInChild(
  {
    instrument,
    instrumentPath,
    note,
    stagingDir,
  }: {
    instrument: number,
    instrumentPath: string,
    note: number,
    stagingDir: string,
  },
): Promise<void> {
  const cp = fork(
    "./run-generate",
  );

  // const handleProcExit = () => {
  //   cp.kill();
  //   process.off("beforeExit", handleProcExit);
  // };

  // process.on("beforeExit", handleProcExit);

  const promise = new Promise<void>(
    (resolve, reject) => {
      let isComplete = false;
      cp.on("exit", () => {
        if (!isComplete) {
          resolve();
          // process.off("beforeExit", handleProcExit);
          isComplete = true;
        }
      });

      cp.on("error", (err) => {
        if (!isComplete) {
          reject(err);
          // process.off("beforeExit", handleProcExit);
          isComplete = true;
        }
      });

      cp.on("message", (message: any) => {
        if (message.error && !isComplete) {
          reject(message.error);
          isComplete = true;
        }

        if (message.messages) {
          message.messages.forEach(
            (msg: [any]) => debug(...msg),
          );
        }
      });
    },
  );

  cp.send({
    enableDebug: program.debug,
    instrument,
    instrumentPath,
    note,
    soundfontFilePath,
    stagingDir,
  });

  return promise;
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
    const progressBar = debug.enabled ?
      // If we have debugger statements, those will quickly push the progress bar offscreen,
      // don't bother showing it
      null :
      new ProgressBar(
        "[:bar] (:percent)",
        {
          complete: "=",
          incomplete: " ",
          total: soundfont.presets.length * maxNoteNumber,
          width: 40,
        },
      );

    if (progressBar) {
      progressBar.render();
    }

    // let instrumentCount = 0;
    for (const preset of soundfont.presets) {
      const instrumentPath = path.join(baseDir, preset.MIDINumber.toString());

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
          () => processInChild({
            instrument: preset.MIDINumber,
            instrumentPath,
            note,
            stagingDir,
          }),
        );

        // Make sure to tick whether it's resolved or rejected--but no need
        // to catch on the promise that gets pushed (otherwise we'd need to
        // propagate the error)
        promise.then(
          () => {
            if (progressBar) {
              progressBar.tick();
            }
          },
        ).catch(
          () => {
            if (progressBar) {
              progressBar.tick();
            }
          },
        );

        promises.push(promise);
      }
      /// DEBUG
      // if (instrumentCount++ === 50) {
      //   break;
      // }
      /// END DEBUG
    }

    // promises.push(cpPromise);
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
