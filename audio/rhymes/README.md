# Recorded rhymes

Put a recording of a rhyme here (MP3, mono, 64–96 kbps keeps it small), then add
two fields to that rhyme in `data/rhymes.json`:

```json
"audio": "audio/rhymes/twinkle.mp3",
"pageAt": [0, 7.5, 15]
```

- `audio` — the file path from the site root.
- `pageAt` — the second at which each verse (page) starts. Leave it out and the
  verses are spread evenly over the song.

The player then plays the recording instead of the phone's voice, turns the
verses on time and lights up each line. Rhymes without `audio` keep the voice.

Only use recordings you made yourself or have the rights to (the traditional
rhymes' words and tunes are public domain; most published recordings are not).
