import Soundfont from "./soundfont";

/// DEBUG

const sfpath = "/usr/share/sounds/sf2/FluidR3_GM.sf2";

/// END DEBUG

Soundfont.parse(sfpath).then(
  (sf) => {
    console.log(sf + "");
    console.log(sf);
  },
);
