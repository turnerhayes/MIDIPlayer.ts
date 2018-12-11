import fs from "fs";
import path from "path";

import parseWav from "./wav-parser";

const filePath = path.resolve(__dirname, "..", "soundfonts", "rendered-samples", "Funk Guitar", "Clean F10.wav");

new Promise<Buffer>(
  (resolve, reject) => fs.readFile(
    filePath,
    (err: any, file: Buffer) => {
      if (err) {
        return reject(err);
      }

      return resolve(file);
    },
  ),
).then(
  (file) => {
    const parsedWav = parseWav(file);

    return new Promise<void>(
      (resolve, reject) => fs.writeFile(
        path.join(__dirname, "parse-wav-out.json"),
        JSON.stringify(parsedWav, null, "  "),
        (err) => {
          if (err) {
            return reject(err);
          }

          return resolve();
        },
      ),
    );
  },
).catch(
  (err) => console.error(err),
);
