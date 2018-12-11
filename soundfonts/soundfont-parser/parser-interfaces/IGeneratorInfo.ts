import GeneratorTypes from "../generator-types";
import GeneratorValue from "../generator-value";

export default interface IGeneratorInfo {
  generatorType: GeneratorTypes;
  value: GeneratorValue;
  index: number;
}
