"use strict";

// This is passed in an unsigned 16-bit integer array. It is converted to a 32-bit float array.
// The first startIndex items are skipped, and only 'length' number of items is converted.
function int16ToFloat32(inputArray, startIndex, length) {
  if (startIndex === undefined) {
    startIndex = 0;
  }

  if (length === undefined) {
    length = inputArray.length;
  }
  const output = new Float32Array(inputArray.length - startIndex);
  for (let i = startIndex; i < length; i++) {
    const int = inputArray[i];
    // If the high bit is on, then it is a negative number, and actually counts backwards.
    // const float = (int < 0) ? -(0x10000 - int) / 0x8000 : int / 0x7FFF;
    // const float = int < 0 ?
    //   (int / 32768) :
    //   (int / 32767)
    const float = int / 32768;
    output[i] = float;
  }
  return output;
}

const getSampleDataPromise = fetch(
  "./rendered-samples/samples.json"
).then(
  (response) => response.json()
);

let button;
let shiftInput;
let loopCheckbox;
let durationInput;

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const sampleSelector = document.getElementById("sampleselector");
    shiftInput = document.getElementById("shiftinput");
    loopCheckbox = document.getElementById("loopcheckbox");
    durationInput = document.getElementById("noteduration");

    getSampleDataPromise.then(
      (sampleData) => {
        return [undefined].concat(
          Object.keys(sampleData),
        );
      }
    ).then(
      (optionValues) => {
        optionValues.forEach(
          (value) => {
            const option = document.createElement("option");

            if (value === undefined) {
              option.textContent = "----";
            } else {
              option.setAttribute("value", value);
              option.textContent = value;
            }

            sampleSelector.appendChild(option);
          }
        )
      }
    );

    button = document.getElementById("playbutton");

    sampleSelector.addEventListener(
      "change",
      (event) => {
        if (button.__handler) {
          button.removeEventListener("click", button.__handler);
        }
        const sample = event.target.value;

        if (sample) {
          loadSample(sample);
        }
      }
    );
  }
);

function getSample(sampleName) {
  return getSampleDataPromise.then(
    (sampleData) => {
      const samplePath = "./" + sampleData[sampleName].raw;

      return fetch(
        encodeURIComponent(samplePath), {}
      ).then(
        (response) => response.arrayBuffer()
      );
    }
  )
}

function getSampleWav(sampleName) {
  return getSampleDataPromise.then(
    (sampleData) => {
      const samplePath = "./" + sampleData[sampleName].wav;

      return fetch(
        encodeURIComponent(samplePath), {}
      ).then(
        (response) => response.arrayBuffer()
      ).then(
        (wavArrayBuffer) => {
          const parsedWav = WAVParser.default(wavArrayBuffer);

          return {
            wavBuffer: wavArrayBuffer,
            parsedWav,
          };
        }
      );
    }
  )
}

function trim(text) {
  if (!text) {
    return text;
  }

  return text.replace(/^\s+/, "").replace(/\s+$/, "");
}

function getSampleMetadata(sampleName) {
  return getSampleDataPromise.then(
    (sampleData) => {
      const metadataPath = "./" + sampleData[sampleName].metadata;

      return fetch(
        encodeURIComponent(metadataPath), {}
      ).then(
        (response) => response.json()
      );
    }
  )
}

function loadSample(sampleName) {
  Promise.all(
    [
      getSampleWav(sampleName),
      getSampleMetadata(sampleName),
    ]
  ).then(
    ([{ wavBuffer, parsedWav }, metadata]) => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();

      if (metadata.pitchCorrection) {
        shiftInput.value = metadata.pitchCorrection;
      }
      else {
        shiftInput.value = 0;
      }

      console.log({
        parsedWav,
      });

      return ctx.decodeAudioData(wavBuffer).then(
        (wavBuffer) => ({
          ctx,
          wavBuffer,
          parsedWav,
          metadata,
        })
      );
    }
  ).then(
    ({
      ctx,
      wavBuffer,
      parsedWav,
      metadata,
    }) => {
      let isStarted = false;

      let src;
      let destination;

      const handler = () => {
        ctx.resume().then(
          () => {
            
            if (isStarted) {
              src.stop(0);
              src.disconnect(destination);
              isStarted = false;
              destination = undefined;
              button.textContent = "Play";
            } else {
              src = ctx.createBufferSource();
              const pitchChangeHandler = (event) => {
                const value = event.target.valueAsNumber;

                if (!Number.isNaN(value)) {
                  src.detune.value = value;
                }
              };

              if (shiftInput.__srcChangeHandler) {
                shiftInput.removeEventListener("change", shiftInput.__srcChangeHandler);
              }

              shiftInput.addEventListener(
                "change",
                pitchChangeHandler
              );

              shiftInput.__srcChangeHandler = pitchChangeHandler;

              const checkboxHandler = (event) => {
                if (src === undefined) {
                  return;
                }

                src.loop = event.target.checked;
              };

              src.addEventListener(
                "ended",
                () => {
                  src.disconnect(destination);
                  src = undefined;
                  isStarted = false;
                  destination = undefined;
                  button.textContent = "Play";
                }
              );
  
              if (loopCheckbox.__handler) {
                loopCheckbox.removeEventListener("change", loopCheckbox.__handler);
              }
              
              loopCheckbox.addEventListener("change", checkboxHandler);
              loopCheckbox.__handler = checkboxHandler;

              let detuneValue = shiftInput.valueAsNumber || 0;

              if (parsedWav.cues.length > 0) {
                src.loop = loopCheckbox.checked;
                src.loopStart = parsedWav.cues[0].timeOffset;
                src.loopEnd = parsedWav.cues[1].timeOffset;
              }

              if (metadata.pitchCorrection) {
                detuneValue += metadata.pitchCorrection;
                shiftInput.value = detuneValue;
              }

              destination = ctx.destination;
              if (detuneValue) {
                src.detune.value = detuneValue;
              }

              if (metadata.pan) {
                const panNode = ctx.createStereoPanner();

                // pan is in 0.1% points; needs to be in the range [-1, 1]
                const pan = metadata.pan / 1000;

                panNode.pan.value = pan;

                destination = panNode;

                panNode.connect(ctx.destination);
              }

              src.buffer = wavBuffer;

              src.connect(destination);
              src.start(0);
              isStarted = true;
              button.textContent = "Stop";
            }
          }
        )
      };

      button.removeAttribute("disabled");
      button.addEventListener(
        "click",
        handler
      );

      button.__handler = handler;
    }
  );
}
