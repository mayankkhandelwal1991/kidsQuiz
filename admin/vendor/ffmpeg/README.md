# @ffmpeg/ffmpeg 0.12.10 (ESM build, MIT licence)

Copied unchanged from https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/ so its
web worker is served from this site (browsers block workers from other sites).
The ffmpeg engine itself (@ffmpeg/core 0.12.6, ~31 MB) is loaded from jsDelivr on first use.

Used by admin/index.html (Instagram Studio) to convert a Reel's sound to AAC, which
Instagram needs, when Chrome cannot record AAC itself (Chrome on Linux).
