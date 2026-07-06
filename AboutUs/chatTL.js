// =========================
// chat.js
// =========================

export async function createChatTimeline() {

  // =========================
  // LOAD JSON
  // =========================

  const response =
    await fetch("./message.json");

  const messages =
    await response.json();

  // =========================
  // GET CONTAINER
  // =========================

  const container =
    document.getElementById("chatContainer");

  // clear old content
  container.innerHTML = "";

  // =========================
  // GENERATE CHAT HTML
  // =========================

  messages.forEach((msg, index) => {

    
    let pre_innerhtml = `
      <div class="message ${msg.side} msg-${index}">

        <img
          class="avatar"
          src="${msg.avatar}"
        >

        <div class="bubble">

          <div class="name">
            ${msg.name}
          </div>

          <div id="pend-img"></div>

          <div class="text">
            ${msg.text}
          </div>

          <div class="time">
            ${msg.time}
          </div>

        </div>

      </div>

    `;
    if(msg.img){
      const parser = new DOMParser();
      const dc = parser.parseFromString(pre_innerhtml, 'text/html');
      dc.getElementById("pend-img").innerHTML += `<img class="chat-image" src="${msg.img}">`
      pre_innerhtml = dc.body.innerHTML
      console.log(dc.body.innerHTML)
    }
    container.innerHTML += pre_innerhtml
  });

  // =========================
  // TYPING BUBBLE
  // =========================

  container.innerHTML += `

    <div class="typing">

      <span></span>
      <span></span>
      <span></span>

    </div>

  `;

  // =========================
  // TYPING DOTS ANIMATION
  // =========================

  gsap.to(".typing span", {

    y:-5,

    repeat:-1,

    yoyo:true,

    stagger:0.15,

    duration:0.3,

    ease:"power1.inOut"

  });

  // =========================
  // CHAT TIMELINE
  // =========================

  const tl = gsap.timeline({

    scrollTrigger: {

      trigger: ".chat-section",
      start: "top 80%",
      end: "bottom 50%",
      scrub: 1

      // markers:true

    }

  });

  // =========================
  // MESSAGE ANIMATION
  // =========================

  messages.forEach((msg, index) => {

    tl.fromTo(

      `.msg-${index}`,

      {

        opacity:0,

        x:
          msg.side === "right"
            ? 100
            : -100,

        y:50,

        scale:0.9,

        filter:"blur(10px)"

      },

      {

        opacity:1,

        x:0,

        y:0,

        scale:1,

        filter:"blur(0px)",

        duration:2,

        ease:"power2.out"

      }

    ,"+=1");

  });

  // =========================
  // TYPING SHOW
  // =========================

  tl.fromTo(

    ".typing",

    {

      opacity:0,

      y:20

    },

    {

      opacity:1,

      y:0,

      duration:1

    }

  ,">")

  .to(".chat-container", {

    opacity: 0,

    filter: "blur(20px)",

    duration: 2

  },"+=1");


  // =========================
  // RETURN TIMELINE
  // =========================

  return tl;

}