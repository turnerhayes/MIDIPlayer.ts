import fs from "fs";

import Soundfont from "./soundfont";

const sfpath = "/usr/share/sounds/sf2/FluidR3_GM.sf2";

Soundfont.parse(sfpath).then(
  (sf) => {
    return new Promise(
      (resolve, reject) => fs.writeFile(
        "./parse-out.json",
        JSON.stringify(sf, null, "  "),
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
