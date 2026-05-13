export function createLogoTimeline() {

  const tl_logo = gsap.timeline({
    scrollTrigger: {
      trigger: ".parallax-header",
      start: "top top",
      end: "+=2000",
      scrub: true,
      pin: true,
    }
  });



  tl_logo.from(".header-logo", {
    opacity: 0,
    y: -50,
    duration: 1,
    delay: 0.5,
    ease: "power2.out"
  }, "-=0.5")
    .to(".parallax-header", {
      scale: 1.2,
      duration: 1,
      ease: "power2.out"
    }, "-=0.5")
    .to(".header-text", {
      opacity: 0
    }, "-=0.5")
    .to(".header-logo", {
      scale: 5,
      opacity: 0,
      duration: 1,
      ease: "power2.out"
    }, "-=0.5")
  return tl_logo;

}