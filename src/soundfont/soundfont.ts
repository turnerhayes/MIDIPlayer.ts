import fetchPonyfill from "fetch-ponyfill";
import urlResolve from "url-resolve";
import Instrument from "./instrument";

const { fetch } = fetchPonyfill();

interface IConfigurationOptions {
  baseURL?: string;
}

interface IGetInstrumentArguments {
  instrumentID: number;
}

interface IGetInstrumentURLArguments {
  instrumentID: number;
}

class Soundfont {
  // tslint:disable-next-line:variable-name
  private _baseURL = "./soundfont/";

  private instrumentPromises: {[instrumentID: number]: Promise<Instrument>} = {};

  public get baseURL() {
    return this._baseURL;
  }

  public configure(options: IConfigurationOptions): void {
    if (options.baseURL) {
      this._baseURL = options.baseURL;
    }
  }

  public getInstrument({ instrumentID }: IGetInstrumentArguments): Promise<Instrument> {
    if (!(instrumentID in this.instrumentPromises)) {
      const url = this.getInstrumentURL({ instrumentID });

      this.instrumentPromises[instrumentID] = fetch(
        url,
      ).then(
        () => {
          return new Instrument({
            id: instrumentID,
          });
        },
      );
    }

    return this.instrumentPromises[instrumentID];
  }

  private getInstrumentURL({ instrumentID }: IGetInstrumentURLArguments): string {
    const origin = (global as any).origin || "";

    const url = urlResolve(origin, this.baseURL, instrumentID);

    return url;
  }
}

export default new Soundfont();
