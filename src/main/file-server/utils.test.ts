import { fileExistsSync } from "./utils";

const exists1 = __dirname + "/test-files/a.txt";
const exists2 = __dirname + "/test-files/a-subdir/b.txt";
const doesntExist = __dirname + "/test-files/doesnt-exist.txt";

test("appReducer isLoading on", () => {
  expect(fileExistsSync(exists1)).toBe(true);
  expect(fileExistsSync(exists2)).toBe(true);
  expect(fileExistsSync(doesntExist)).toBe(false);
});
