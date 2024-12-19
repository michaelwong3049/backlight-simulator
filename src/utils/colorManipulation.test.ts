// Create-React-App will auto add and import the jest testing library into your
// project. Read more about jest online. The getting started page gives a decent
// but brief summary and the API makes it clear what functions are available to you.
// getting started: https://jestjs.io/docs/using-matchers
// jest api: https://jestjs.io/docs/api
//
// Any time we find a bug, we should add a test to make sure we don't
// reintroduce that bug in the future. This is behavioral testing or
// behavioral driven development.
//
// Run tests in an interactive terminal with `npm test`. Learn more at the
// Create-React-App docs: https://create-react-app.dev/docs/running-tests/

import { getAverageColor } from '@/utils/colorManipulation';

// Use a describe block to group related tests, e.g. all of the tests for the
// `getAverageColor` function are in the same describe.
describe('getAverageColor', () => {
  // I declare these vary early on so we can refer to them in all future if/test
  // blocks. This `beforeEach` hook will run before every test. This means that
  // for every test that runs, we get a fresh canvas and context so there isn't
  // any test influencing others.
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  });

  // Use a `test` or `it` block to run an actual test. The string is just a brief
  // description of the scenario or specific code path you're testing. The
  // function is the actual test. The `it` and your string should read like a sentence.
  it('averages one color as itself', () => {
    // Setting up the dummy data that my test can use
    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Determine what my test should return by hand
    const expected = [255, 0, 0, 255];

    // Run my code and get it's actual output
    const actual = getAverageColor(frame, 0, 0, canvas.height, canvas.width);

    // Use an expect to actual run assertions with the matchers that jest provides
    expect(actual).toEqual(expected);
  });

  // lol i ran this test and found a bug
  it('averages two colors', () => {
    // draw half black, half white
    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(
      canvas.width / 2,
      canvas.height / 2,
      canvas.width,
      canvas.height
    );

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // average color should just be gray
    const expected = [128, 128, 128, 255];
    const actual = getAverageColor(frame, 0, 0, canvas.height, canvas.width);

    // wut it's not gray
    expect(actual).toEqual(expected);
  });
});
