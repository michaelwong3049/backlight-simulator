# TODO

testing goals:
1. make sure this works on places other than machine
2. make sure the math is correct
  - when i pass in a video, and run it through the gpu, then i expect a certain output array texture
    - test video resolution (1920x1080)
    - test aspect ratios (squares, etc.)
    - test divisions increasing
    - test that a color is consistent at the border(s)
    - test that a divsion surrounded by divisions still renders correctly
3. how can we unit test the shader
  - idk, this a good question tho
4. how can we unit test the GPUEngine class
  - test bind groups and buffer assignment
  - we want to avoid a case where "there's no errors but we're wrong"
5. test against resource leak (buffers, memory, etc.)
6. performance testing
  - does my product work well against high resolution videos (4k)
  - how often am i dropping frames?
  - does this work with variable frame rate (30fps, 60fps, 180fps)

how do we actually test something:
- since all of these features are built for the web, we are
gonna have a difficult trying to test NOT on the web.
- the question: how do run i tests on another machine that can
make its browser
