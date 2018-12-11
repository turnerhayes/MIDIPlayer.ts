declare module "riff-chunks" {
  export function riffChunks(data: Uint8Array): IChunk;
  
  export function findChunk(chunks: IChunk[], chunkId: string, multiple?: boolean): IChunk|IChunk[]|null;
}


declare interface IChunk {
  chunkId: string;
  chunkSize: number;
}

declare interface IListChunk extends IChunk {
  format: string;
  subChunks: IChunk[];
}

declare interface IDataChunk extends IChunk {
  chunkData: {
    start: number,
    end: number,
  };
}
