# Audio limitations

- Slice 1 validates container and audio-stream metadata; it does not assess musical quality.
- Browser codec support varies. WAV, MP3, and AAC/M4A are the safest common choices. A file can pass FFprobe validation yet be unplayable in a particular browser.
- Metadata duration is reported by FFprobe and may be approximate for variable-bitrate or damaged files.
- The 500 MB limit is a safety boundary for a local workstation, not a model limit.
- Demucs separation is probabilistic. Bleed, phase artifacts, missing transients, and incorrect instrument assignment are expected, especially in dense or distorted mixes.
- `Other` combines guitars, keyboards, strings, effects, and any material outside vocals, drums, and bass. It is not a lead-guitar or rhythm-guitar stem.
- The first real separation needs network access to download `htdemucs`; later runs use the local PyTorch cache.
- Riffmancer reports named stages rather than invented percentages because the Demucs CLI does not provide a stable structured progress API.
- Four stems are decoded into browser memory for synchronized playback. Very long files may exceed browser or system memory; downloadable WAVs remain available even if browser decoding fails.
- Stem duration can differ slightly because of codec padding. The shared transport uses one timeline and schedules every stem at the same Web Audio time.
- No transcription exists in Slice 2. Later AI output will be treated as an editable draft with confidence and source timing, never as ground truth.
