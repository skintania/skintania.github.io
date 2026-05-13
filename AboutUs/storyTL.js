export function createStoryTimeline(){

  const tl = gsap.timeline({

    scrollTrigger:{

      trigger:".story",

      start:"top top",

      end:"+=3000",

      scrub:1,

      pin:true

    }

  })

  // background


  .fromTo("#main",

    {
      scale:1.2,
      opacity:0
    },

    {
      scale:1,
      opacity:1,
      duration:2
    }

  )

  // tree parallax

  .fromTo("#tree",

    {
      x:400,
      opacity:0
    },

    {
      x:230,
      duration:3,
      opacity:1
    },

    ">"
  )

  // school

  .fromTo("#SK",

    {
      y:100,
      opacity:0
    },

    {
      y:0,
      opacity:1,
      duration:2
    },

    ">"
  )

  // student
.fromTo("#std",

    {
      x:100,
      y:0,
      opacity:0,
 
    },

    {
      x:0,
      y:0,
      opacity:1,
      duration:5
    },

    ">"
  );

  return tl;

}