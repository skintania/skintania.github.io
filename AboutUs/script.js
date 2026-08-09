import { createLogoTimeline } from "./logoTL.js";
import { createChatTimeline } from "./chatTL.js";
import { createStoryTimeline } from "./storyTL.js";

gsap.registerPlugin(ScrollTrigger);

gsap.to(".header-text i", {
  y: 5,
  duration: 0.5,
  repeat: -1,
  yoyo: true,
  ease: "power1.inOut"
});

createLogoTimeline();
await createChatTimeline();
createStoryTimeline();