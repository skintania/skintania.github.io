const player = document.getElementById("videoPlayer");
const catalog = document.getElementById("catalog");

const PLAYLIST_ID = "PLb-1vsRR1f1tjEaHnEZPPceDbSgtFRloc";
const API_KEY = "AIzaSyD7zmtDl-f74E_cD1WsVnszeOEor6alFTc";

function playVideo(videoId, el) {
    document.querySelectorAll(".item").forEach(i => {
    i.classList.remove("active");
    });
    el.classList.add("active");
    player.src = `https://www.youtube.com/embed/${videoId}`;
}
fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${PLAYLIST_ID}&key=${API_KEY}`).then(res => res.json()).then(data => {
    data.items.forEach((item, index) => {
    const title = item.snippet.title;
    const videoId = item.snippet.resourceId.videoId;
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = title;
    div.onclick = () => playVideo(videoId, div);
    catalog.appendChild(div);
    if (index === 0) {
        div.classList.add("active");
        playVideo(videoId, div);
    }
    });
}).catch(err => {
    console.error("โหลด playlist ไม่ได้", err);
});