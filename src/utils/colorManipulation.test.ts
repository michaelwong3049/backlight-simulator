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

import { Dimensions, Division, Position } from "@/types";
import {
  computeDivisions,
  findVideoPositionOnCanvas,
  getAverageColor,
  regionConvolution
} from "@/utils/colorManipulation";
import { BrowserCompatibleImageData } from "@/utils/BrowserCompatibleImageData";
global.ImageData = BrowserCompatibleImageData; 

// Use a describe block to group related tests, e.g. all of the tests for the
// `getAverageColor` function are in the same describe.
describe("colorManipulation", () => {
  // I declare these vary early on so we can refer to them in all future if/test
  // blocks. This `beforeEach` hook will run before every test. This means that
  // for every test that runs, we get a fresh canvas and context so there isn't
  // any test influencing others.
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  describe("getAverageColor", () => {
    // Use a `test` or `it` block to run an actual test. The string is just a brief
    // description of the scenario or specific code path you're testing. The
    // function is the actual test. The `it` and your string should read like a sentence.
    it("averages one color as itself", () => {
      // Setting up the dummy data that my test can use
      ctx.fillStyle = "rgb(255, 0, 0)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Determine what my test should return by hand
      const expected = [255, 0, 0, 255];

      // Run my code and get it's actual output
      const actual = getAverageColor(frame, 0, 0, canvas.height, canvas.width);

      // Use an expect to actual run assertions with the matchers that jest provides
      expect(actual).toEqual(expected);
    });

    it("averages two colors", () => {
      ctx.fillStyle = "rgb(0, 0, 0)";
      ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillRect(canvas.width / 2, 0, canvas.width, canvas.height);

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const expected = [128, 128, 128, 255];
      const actual = getAverageColor(frame, 0, 0, canvas.height, canvas.width);
      expect(actual).toEqual(expected);
    });

    it("averages four colors", () => {
      // top left quadrant
      ctx.fillStyle = "rgb(255, 0, 0)";
      ctx.fillRect(0, 0, canvas.width / 4, canvas.height / 4);

      // top right quadrant
      ctx.fillStyle = "rgb(0, 255, 0)";
      ctx.fillRect(canvas.width / 2, 0, canvas.width / 4, canvas.height / 4);

      // bottom left quadrant
      ctx.fillStyle = "rgb(0, 0, 255)";
      ctx.fillRect(0, canvas.height / 2, canvas.width / 4, canvas.height / 4);

      // bottom right quadrant
      ctx.fillStyle = "rgb(0, 0, 0)";
      ctx.fillRect(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 4,
        canvas.height / 4,
      );

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const expected = [16, 16, 16, 255];
      const actual = getAverageColor(frame, 0, 0, canvas.height, canvas.width);
      expect(actual).toEqual(expected);
    });

    it("does not average colors outside of the region", () => {
      // draw the bg red
      ctx.fillStyle = "rgb(255, 0, 0)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // draw a green square in the center
      ctx.fillStyle = "rgb(0, 255, 0)";
      ctx.fillRect(
        canvas.width / 4,
        canvas.width / 4,
        canvas.width / 2,
        canvas.height / 2,
      );

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const expected = [0, 255, 0, 255];
      const actual = getAverageColor(
        frame,
        canvas.height / 4,
        canvas.width / 4,
        (canvas.height * 3) / 4,
        (canvas.width * 3) / 4,
      );
      expect(actual).toEqual(expected);
    });
  });

  describe("computeDivisions", () => {
    it("return even divisions", () => {
      const verticalDivisions = 4,
        horizontalDivisions = 2;
      const videoDimensions: Dimensions = { height: 100, width: 100 };

      // need color to complete the type, but not being tested here
    const expected: Array<Division> = [
        {
          row: 0,
          col: 0,
          width: 50,
          height: 25,
          color: new Uint8ClampedArray([255, 0, 0, 255]),
        },
        {
          row: 0,
          col: 50,
          width: 50,
          height: 25,
          color: new Uint8ClampedArray([255, 0, 0, 255]),
        },
        {
          row: 25,
          col: 0,
          width: 50,
          height: 25,
          color: new Uint8ClampedArray([255, 0, 0, 255]),
        },
        {
          row: 25,
          col: 50,
          width: 50,
          height: 25,
          color: new Uint8ClampedArray([255, 0, 0, 255]),
        },
        {
          row: 50,
          col: 0,
          width: 50,
          height: 25,
          color: new Uint8ClampedArray([255, 0, 0, 255]),
        },
        {
          row: 50,
          col: 50,
          width: 50,
          height: 25,
          color: new Uint8ClampedArray([255, 0, 0, 255]),
        },
        {
          row: 75,
          col: 0,
          width: 50,
          height: 25,
          color: new Uint8ClampedArray([255, 0, 0, 255]),
        },
        {
          row: 75,
          col: 50,
          width: 50,
          height: 25,
          color: new Uint8ClampedArray([255, 0, 0, 255]),
        },
      ];

      const areDivisionsEqual = (d1: Division, d2: Division) =>
        d1.width === d2.width &&
        d1.height === d2.height &&
        d1.row === d2.row &&
        d1.col === d2.col;

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const actual = computeDivisions(
        frame,
        videoDimensions,
        horizontalDivisions,
        verticalDivisions,
      );
      expected.forEach((expectedDiv) => {
        expect(
          actual.some((actualDiv) => areDivisionsEqual(actualDiv, expectedDiv)),
        ).toBe(true);
      });
    });
  });

  describe("findVideoPositionOnCanvas", () => {
    it("find the correct video boundaries for a centered video", () => {
      const videoDimensions: Dimensions = { height: 50, width: 50 };

      const expected: Position = {
        top: 25,
        right: 75,
        bottom: 75,
        left: 25,
      };

      const actual = findVideoPositionOnCanvas(
        { height: canvas.height, width: canvas.width },
        videoDimensions,
      );
      expect(actual).toEqual(expected);
    });
  });

  describe("regionConvolution", () => {
     it("convolves a region based on the kernel size given", () => {
      //cut the left half to be red
      ctx.fillStyle = "rgb(255,0,0)";
      ctx.fillRect(0, 0, canvas.width / 2, canvas.height);

      //cut the right half to be blue
      ctx.fillStyle = "rgb(0,0,255)";
      ctx.fillRect(canvas.width / 2, 0, canvas.width, canvas.height);

      const frame = ctx.getImageData(0,0, canvas.width, canvas.height);

      const actual = regionConvolution(
        frame,
        0,
        0,
        100,
        100,
        10
      );

     })
  })
});