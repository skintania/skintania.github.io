import json
import yt_dlp

with open("videoes.json", 'r') as js:
    ls = json.load(js)

for i in ls:
    (k, v) = i
    print(i[k], i[v])

    url = i[v]

    ydl_opts = {
        'outtmpl': f'{i[k]}.mp4',
        'format': 'bestvideo+bestaudio/best',
        'merge_output_format': 'mp4',
        'noplaylist': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
