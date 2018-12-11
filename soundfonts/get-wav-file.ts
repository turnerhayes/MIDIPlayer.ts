import Sample from "./soundfont-parser/sample";

interface IFormatChunkArguments {
  audioFormat?: number;
  sampleRate: number;
  channels?: number;
}

interface IDataChunkArguments {
  sampleData: DataView;
}

interface ICuePointsChunkArguments {
  sample: Sample;
}

interface ICuePointBufferArguments {
  id: number;
  offset: number;
}

interface IGetLabelChunkArguments {
  cueID: number;
}

const LOOP_START_CUE_ID = 0;

const LOOP_END_CUE_ID = 1;

const BITS_PER_SAMPLE = 16;

const stringToUintArray = (str: string): Uint8Array => {
  const charCodes: number[] = [];

  for (let i = 0, len = str.length; i < len; i++) {
    charCodes.push(str.charCodeAt(i));
  }
  return new Uint8Array(charCodes);
};

function getFormatChunk({
  audioFormat = 1,
  // @todo: handle stereo samples
  channels = 1,
  sampleRate,
}: IFormatChunkArguments): ArrayBuffer {
  const bufferLengths = {
    audioFormat: 2,
    channels: 2,
    sampleRate: 4,
    // tslint:disable-next-line:object-literal-sort-keys
    byteRate: 4,
    blockAlign: 2,
    bitsPerSample: 2,
  };

  const chunkDataSize: number = bufferLengths.audioFormat +
    bufferLengths.channels +
    bufferLengths.sampleRate +
    bufferLengths.byteRate +
    bufferLengths.blockAlign +
    bufferLengths.bitsPerSample;

  // add 4 for chunk ID buffer and 4 for chunk size buffer
  const arrBuffer = new ArrayBuffer(chunkDataSize + 8);

  const view = new DataView(arrBuffer);

  const byteRate = sampleRate * channels * (BITS_PER_SAMPLE / 8);

  const blockAlign = channels * (BITS_PER_SAMPLE / 8);

  let offset: number = 0;
  new Uint8Array(arrBuffer).set(stringToUintArray("fmt "), offset);
  offset += 4;

  view.setUint32(offset, chunkDataSize, true);
  offset += 4;

  view.setUint16(offset, audioFormat, true);
  offset += bufferLengths.audioFormat;

  view.setUint16(offset, channels, true);
  offset += bufferLengths.channels;

  view.setUint32(offset, sampleRate, true);
  offset += bufferLengths.sampleRate;

  view.setUint32(offset, byteRate, true);
  offset += bufferLengths.byteRate;

  view.setUint32(offset, blockAlign, true);
  offset += bufferLengths.blockAlign;

  view.setUint16(offset, BITS_PER_SAMPLE, true);
  offset += bufferLengths.bitsPerSample;

  return arrBuffer;
  // const typeBuffer = Buffer.from("fmt ", "ascii");

  // let size: number = 0;

  // const audioFormatBuffer = Buffer.alloc(2);
  // audioFormatBuffer.writeUInt16LE(audioFormat, 0);
  // size += 2;

  // const channelsBuffer = Buffer.alloc(2);
  // channelsBuffer.writeUInt16LE(channels, 0);
  // size += 2;

  // const sampleRateBuffer = Buffer.alloc(4);
  // sampleRateBuffer.writeUInt32LE(sampleRate, 0);
  // size += 4;

  // const byteRate = sampleRate * channels * (BITS_PER_SAMPLE / 8);

  // const blockAlign = channels * (BITS_PER_SAMPLE / 8);

  // const byteRateBuffer = Buffer.alloc(4);
  // byteRateBuffer.writeUInt32LE(byteRate, 0);
  // size += 4;

  // const blockAlignBuffer = Buffer.alloc(2);
  // blockAlignBuffer.writeUInt16LE(blockAlign, 0);
  // size += 2;

  // const bitsPerSampleBuffer = Buffer.alloc(2);
  // bitsPerSampleBuffer.writeUInt16LE(BITS_PER_SAMPLE, 0);
  // size += 2;

  // const chunkSizeBuffer = Buffer.alloc(4);
  // chunkSizeBuffer.writeUInt32LE(size, 0);

  // return Buffer.concat(
  //   [
  //     typeBuffer,
  //     chunkSizeBuffer,
  //     audioFormatBuffer,
  //     channelsBuffer,
  //     sampleRateBuffer,
  //     byteRateBuffer,
  //     blockAlignBuffer,
  //     bitsPerSampleBuffer,
  //   ],
  //   typeBuffer.length + chunkSizeBuffer.length + size,
  // );
}

function getDataChunk({
  sampleData,
}: IDataChunkArguments): ArrayBuffer {
// }: IDataChunkArguments): Buffer {
  const sampleCount: number = sampleData.byteLength / (BITS_PER_SAMPLE / 8);

  const arrBuffer = new ArrayBuffer(8 + sampleData.byteLength);

  const arr = new Uint8Array(arrBuffer);

  const dataView = new DataView(arrBuffer);

  arr.set(stringToUintArray("data"), 0);

  dataView.setUint32(4, sampleData.byteLength, true);

  arr.set(
    new Uint8Array(sampleData.buffer, sampleData.byteOffset, sampleData.byteLength),
    8,
  );

  return arrBuffer;

  // const chunkIDBuffer = stringToUintArray("data");
  // const chunkIDBuffer = Buffer.from("data", "ascii");

  // const data = new Int16Array(sampleData);

  // const sampleCount: number = data.length/*  * (BITS_PER_SAMPLE / 8) */;

  // const chunkSizeBuffer = Buffer.alloc(4);
  // chunkSizeBuffer.writeUInt32LE(sampleCount, 0);
  // const chunkSizeBuffer = new Uint8Array(4);
  // chunkSizeBuffer.set([sampleCount], 0);

  // const dataBuffer = Buffer.from(sampleData.buffer, sampleData.byteOffset, sampleData.byteLength);
  // const dataBuffer = new Uint8Array(sampleData.buffer, sampleData.byteOffset, sampleData.byteLength);

  // return Buffer.concat(
  //   [
  //     chunkIDBuffer,
  //     chunkSizeBuffer,
  //     dataBuffer,
  //   ],
  //   chunkIDBuffer.length +
  //   chunkSizeBuffer.length +
  //   dataBuffer.length,
  // );

  // return [
  //   chunkIDBuffer,
  //   chunkSizeBuffer,
  //   dataBuffer,
  // ];
}

function getCuePointBuffer({
  id,
  offset,
}: { id: number, offset: number }): Buffer {
  const cueIDBuffer = Buffer.alloc(4);
  cueIDBuffer.writeUInt32LE(id, 0);

  const positionBuffer = Buffer.alloc(4);
  positionBuffer.writeUInt32LE(0, 0);

  const dataChunkIDBuffer = Buffer.from("data", "ascii");

  const chunkStartBuffer = Buffer.alloc(4);
  chunkStartBuffer.writeUInt32LE(0, 0);

  const blockStartBuffer = Buffer.alloc(4);
  blockStartBuffer.writeUInt32LE(0, 0);

  const sampleOffsetBuffer = Buffer.alloc(4);
  sampleOffsetBuffer.writeUInt32LE(offset, 0);

  return Buffer.concat(
    [
      cueIDBuffer,
      positionBuffer,
      dataChunkIDBuffer,
      chunkStartBuffer,
      blockStartBuffer,
      sampleOffsetBuffer,
    ],
    // Always the same size for a cue buffer
    24,
  );
}

function getCuePointsChunk({ sample }: ICuePointsChunkArguments): ArrayBuffer {
  // loop start and loop end
  const NUMBER_OF_CUES = 2;

  // 4 bytes for cue count
  const chunkSize = 4 + (
    // 24 bytes per cue
    NUMBER_OF_CUES * 24
  );

  const loop = sample.loopRange;

  // Add 8 bytes -- 4 for chunk ID, 4 for chunk size
  const arrBuffer = new ArrayBuffer(60);

  const arr = new Uint8Array(arrBuffer);

  const dataView = new DataView(arrBuffer);

  arr.set(stringToUintArray("cue "), 0);

  dataView.setUint32(4, chunkSize, true);

  dataView.setUint32(8, NUMBER_OF_CUES, true);

  let offset = 12;

  // loop start
  dataView.setUint32(offset, LOOP_START_CUE_ID, true);
  offset += 4;

  // cue position in playlist
  dataView.setUint32(offset, 0, true);
  offset += 4;

  // data chunk ID
  arr.set(stringToUintArray("data"), offset);
  offset += 4;

  // chunk start offset (not relevant without wavl chunk)
  dataView.setUint32(offset, 0, true);
  offset += 4;

  // block start offset (not relevant without wavl chunk)
  dataView.setUint32(offset, 0, true);
  offset += 4;

  // sample offset
  dataView.setUint32(offset, loop[0], true);
  offset += 4;

  // loop end
  dataView.setUint32(offset, LOOP_END_CUE_ID, true);
  offset += 4;

  // cue position in playlist
  dataView.setUint32(offset, 0, true);
  offset += 4;

  // data chunk ID
  arr.set(stringToUintArray("data"), offset);
  offset += 4;

  // chunk start offset (not relevant without wavl chunk)
  dataView.setUint32(offset, 0, true);
  offset += 4;

  // block start offset (not relevant without wavl chunk)
  dataView.setUint32(offset, 0, true);
  offset += 4;

  // sample offset
  dataView.setUint32(offset, loop[1], true);
  offset += 4;

  return arrBuffer;
// function getCuePointsChunk({ sample }: ICuePointsChunkArguments): Buffer {
  // const chunkIDBuffer = Buffer.from("cue ", "ascii");

  // const loop = sample.loopRange;

  // const loopStartCueBuffer = getCuePointBuffer({ id: LOOP_START_CUE_ID, offset: loop[0] });

  // const loopEndCueBuffer = getCuePointBuffer({ id: LOOP_END_CUE_ID, offset: loop[1] });

  // const cueCountBuffer = Buffer.alloc(4);
  // cueCountBuffer.writeUInt32LE(2, 0);

  // const totalSize: number = cueCountBuffer.length +
  //   loopStartCueBuffer.length +
  //   loopEndCueBuffer.length;

  // const chunkSizeBuffer = Buffer.alloc(4);
  // chunkSizeBuffer.writeUInt32LE(totalSize, 0);

  // return Buffer.concat(
  //   [
  //     chunkIDBuffer,
  //     chunkSizeBuffer,
  //     cueCountBuffer,
  //     loopStartCueBuffer,
  //     loopEndCueBuffer,
  //   ],
  //   chunkIDBuffer.length +
  //   chunkSizeBuffer.length +
  //   totalSize,
  // );
}
/*
function getLabelChunk({
  cueID,
}: IGetLabelChunkArguments): Buffer {
  const chunkIDBuffer = Buffer.from("labl", "ascii");

  const cueIDBuffer = Buffer.alloc(4);
  cueIDBuffer.writeUInt32LE(cueID, 0);

  let label = cueID === LOOP_START_CUE_ID ?
    "Loop start\0" :
    "Loop end\0";

  // Label must be an even number of characters, and padded with a null byte if it isb't
  if (label.length % 2 !== 0) {
    label = label + "\0";
  }

  const labelBuffer = Buffer.from(label, "ascii");

  const totalSize: number = cueIDBuffer.length +
    label.length;

  const chunkSizeBuffer: Buffer = Buffer.alloc(4);
  chunkSizeBuffer.writeUInt32LE(totalSize, 0);

  return Buffer.concat(
    [
      chunkIDBuffer,
      chunkSizeBuffer,
      cueIDBuffer,
      labelBuffer,
    ],
    chunkIDBuffer.length +
    chunkSizeBuffer.length +
    totalSize,
  );
} */

function getAssociatedDataListChunk(): ArrayBuffer {
  // NOTE: If either label changes, be sure to right-pad with
  // a null byte if the label length is odd.
  const startCueLabel = "Loop start";

  const endCueLabel = "Loop end";

  // 4 bytes for cue ID
  const startCueLabelChunkDataSize: number = 4 +
    startCueLabel.length;

  // 4 bytes for cue ID
  const endCueLabelChunkDataSize: number = 4 +
    endCueLabel.length;

  // 4 bytes for type ID
  const chunkSize: number = 4 +
    // Each label chunk has 4 bytes for chunk ID + 4 bytes for chunk size,
    // plus whatever size the rest of it is
    8 + startCueLabelChunkDataSize +
    8 + endCueLabelChunkDataSize;

  // 4 bytes for chunk ID + 4 bytes for chunk size
  const arrBuffer = new ArrayBuffer(8 + chunkSize);

  const arr = new Uint8Array(arrBuffer);

  const dataView = new DataView(arrBuffer);

  arr.set(stringToUintArray("LIST"), 0);

  dataView.setUint32(4, chunkSize, true);

  arr.set(stringToUintArray("adtl"), 8);

  let offset: number = 12;
  // Start cue label
  arr.set(stringToUintArray("labl"), offset);
  offset += 4;

  dataView.setUint32(offset, startCueLabelChunkDataSize, true);
  offset += 4;

  dataView.setUint32(offset, LOOP_START_CUE_ID, true);
  offset += 4;

  arr.set(stringToUintArray(startCueLabel), offset);
  offset += startCueLabel.length;

  // End cue label
  arr.set(stringToUintArray("labl"), offset);
  offset += 4;

  dataView.setUint32(offset, endCueLabelChunkDataSize, true);
  offset += 4;

  dataView.setUint32(offset, LOOP_END_CUE_ID, true);
  offset += 4;

  arr.set(stringToUintArray(endCueLabel), offset);
  offset += endCueLabel.length;

  return arrBuffer;
}

// function getAssociatedDataListChunk(): Buffer {
//   const chunkIDBuffer = Buffer.from("LIST", "ascii");

//   const typeIDBuffer = Buffer.from("adtl", "ascii");

//   const startCueLabelBuffer = getLabelChunk({
//     cueID: LOOP_START_CUE_ID,
//   });

//   const endCueLabelBuffer = getLabelChunk({
//     cueID: LOOP_END_CUE_ID,
//   });

//   const totalSize: number = typeIDBuffer.length +
//     startCueLabelBuffer.length +
//     endCueLabelBuffer.length;

//   const chunkSizeBuffer = Buffer.alloc(4);
//   chunkSizeBuffer.writeUInt32LE(totalSize, 0);

//   return Buffer.concat(
//     [
//       chunkIDBuffer,
//       chunkSizeBuffer,
//       typeIDBuffer,
//       startCueLabelBuffer,
//       endCueLabelBuffer,
//     ],
//     chunkIDBuffer.length +
//     chunkSizeBuffer.length +
//     totalSize,
//   );
// }

export default function getWavFile(sampleData: DataView, sample: Sample): Buffer|ArrayBuffer|Int8Array {
  const formatBuffer = getFormatChunk({
    sampleRate: sample.sampleRate,
  });

  const dataBuffer = getDataChunk({ sampleData });

  const cueBuffer = getCuePointsChunk({ sample });

  const associatedDataListBuffer = getAssociatedDataListChunk();

  // First length is for WAVE header
  const chunkDataSize: number = 4 +
    formatBuffer.byteLength +
    dataBuffer.byteLength +
    cueBuffer.byteLength +
    associatedDataListBuffer.byteLength;

  const buffer = new ArrayBuffer(
    // 4 bytes each for RIFF header and master chunk size header
    8 +
    chunkDataSize,
  );

  const arr = new Uint8Array(buffer);
  const view = new DataView(buffer);

  arr.set(stringToUintArray("RIFF"), 0);
  view.setUint16(4, chunkDataSize, true);
  arr.set(stringToUintArray("WAVE"), 8);

  let offset = 12;

  arr.set(new Uint8Array(formatBuffer), offset);
  offset += formatBuffer.byteLength;
  arr.set(new Uint8Array(dataBuffer), offset);
  offset += dataBuffer.byteLength;
  arr.set(new Uint8Array(cueBuffer), offset);
  offset += cueBuffer.byteLength;
  arr.set(new Uint8Array(associatedDataListBuffer), offset);
  offset += associatedDataListBuffer.byteLength;

  return buffer;

  // const cuePointsChunkBuffer = getCuePointsChunk({
  //   sample,
  // });

  // const associatedDataListChunk = getAssociatedDataListChunk({});

  // const riffHeaderBuffer = Buffer.from("RIFF", "ascii");

  // const wavFormatBuffer = Buffer.from("WAVE", "ascii");

  // const totalSize: number = wavFormatBuffer.length +
  //   formatChunkBuffer.length +
  //   dataChunkBuffer.length +
  //   cuePointsChunkBuffer.length +
  //   associatedDataListChunk.length;

  // const chunkSizeBuffer = Buffer.alloc(4);
  // chunkSizeBuffer.writeUInt32LE(totalSize, 0);

  // const fileBuffer = Buffer.concat(
  //   [
  //     riffHeaderBuffer,
  //     chunkSizeBuffer,
  //     wavFormatBuffer,
  //     formatChunkBuffer,
  //     dataChunkBuffer,
  //     cuePointsChunkBuffer,
  //     associatedDataListChunk,
  //   ],
  //   riffHeaderBuffer.length +
  //   chunkSizeBuffer.length +
  //   totalSize,
  // );

  // return fileBuffer;
}
