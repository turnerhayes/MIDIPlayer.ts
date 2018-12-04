module.exports = {
  "preset": "ts-jest",
  "roots": [
    "<rootDir>/src"
  ],
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  // "testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.ts$",
  "moduleFileExtensions": [
    "ts",
    "js",
    "json",
  ],
  "globals": {
    "ts-jest": {
      "diagnostics": {
        "warnOnly": true,
      },
    },
  }
};
