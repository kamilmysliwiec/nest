import { expect } from 'chai';
import { filterAsyncGenerator } from '../../../multipart/utils';

describe('filterAsyncGenerator', () => {
  const numbers = [1, 2, 3, 4, 5];
  async function* asyncGeneratorToFilter() {
    for (const number of numbers) {
      yield number;
    }
  }
  const filterCondition = (value: number) => value > 3;

  describe('filter', () => {
    it('should not add filtered values into async generator', async () => {
      const filteredAsyncGenerator = filterAsyncGenerator<number>(
        asyncGeneratorToFilter(),
        async value => filterCondition(value),
      );
      for await (const value of filteredAsyncGenerator) {
        expect(filterCondition(value)).to.be.true;
      }
    });
  });
});
