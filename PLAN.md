# TODO 

- [ ] play/pause button
- [ ] how do we get videos? preset videos, links, files?
- [ ] configurable algorithm
- [ ] configurable target section

# PLAN

1. play a video
2. get a single frame
3. extract the 3x3 color average
4. (stretch) smooth gradient between 3x3
5. render the average colors BEHIND the video

# QUESTIONS

- how to render videos with canvas API?
- how to extract each frame in canvas
- the raw average of colors might be ugly. weighted color average maybe?
- maybe average is bad a formula/aggregator, most common color seen?
- maybe not 3x3 but instead outer ring?