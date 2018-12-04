import { Response } from "node-fetch";
import Instrument from "./instrument";

describe("Soundfont class", () => {
  it("should fetch an instrument if it isn't in cache", async () => {
    jest.resetModules();
    expect.assertions(1);

    const instrumentID = 1;

    const instrument = new Instrument({
      id: instrumentID,
    });

    const fetchMock = jest.fn().mockName("mock_fetch").mockResolvedValue(
      new Response(),
    );

    jest.doMock("fetch-ponyfill", () => {
      return () => ({
        Response,
        fetch: fetchMock,
      });
    });

    const module = await import("./soundfont");

    const Soundfont = module.default;
    Soundfont.getInstrument({ instrumentID: 1 });

    expect(fetchMock).toHaveBeenCalled();
  });

  it("should not fetch an instrument if it is in cache", async () => {
    jest.resetModules();
    expect.assertions(1);

    const instrumentID = 1;

    const instrument = new Instrument({
      id: instrumentID,
    });

    const fetchMock = jest.fn().mockName("mock_fetch").mockResolvedValue(
      new Response(),
    );

    jest.doMock("fetch-ponyfill", () => {
      return () => ({
        Response,
        fetch: fetchMock,
      });
    });

    const module = await import("./soundfont");

    const Soundfont = module.default;

    // prime the cache
    Soundfont.getInstrument({ instrumentID });

    // remove call information from the fetch mock
    fetchMock.mockClear();

    Soundfont.getInstrument({ instrumentID });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
