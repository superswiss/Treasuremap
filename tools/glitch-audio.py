from __future__ import annotations

import math
import random
import struct
import sys
import wave
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: glitch-audio.py input.wav output.wav [minor|villain]", file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    mode = sys.argv[3] if len(sys.argv) > 3 else "minor"

    with wave.open(str(input_path), "rb") as source:
        params = source.getparams()
        frames = source.readframes(source.getnframes())

    if params.sampwidth != 2:
        print(f"Skipping {input_path.name}: expected 16-bit PCM WAV.", file=sys.stderr)
        return 0

    samples = list(struct.unpack("<" + "h" * (len(frames) // 2), frames))

    if mode == "villain":
        samples = slow_and_lower(samples, factor=1.16)
        samples = add_stutters(samples, params.framerate, params.nchannels, count=7)
        samples = add_static(samples, amount=0.035, every_n=17)
        samples = bitcrush(samples, step=768)
    else:
        samples = add_stutters(samples, params.framerate, params.nchannels, count=3)
        samples = add_static(samples, amount=0.018, every_n=31)

    clipped = [max(-32768, min(32767, int(sample))) for sample in samples]
    output_frames = struct.pack("<" + "h" * len(clipped), *clipped)

    with wave.open(str(output_path), "wb") as target:
        target.setparams(params)
        target.writeframes(output_frames)

    return 0


def slow_and_lower(samples: list[int], factor: float) -> list[int]:
    if factor <= 1:
        return samples

    output_length = int(len(samples) * factor)
    output: list[int] = []

    for index in range(output_length):
        source_position = index / factor
        left = int(math.floor(source_position))
        right = min(left + 1, len(samples) - 1)
        mix = source_position - left
        output.append(int(samples[left] * (1 - mix) + samples[right] * mix))

    return output


def add_stutters(samples: list[int], frame_rate: int, channels: int, count: int) -> list[int]:
    random.seed(1980 + count)
    output = samples[:]
    slice_length = max(1, int(frame_rate * channels * 0.075))
    start_limit = max(slice_length + 1, len(output) - slice_length - 1)

    for _ in range(count):
        start = random.randint(slice_length, start_limit)
        segment = output[start : start + slice_length]
        output[start:start] = segment + segment

    return output


def add_static(samples: list[int], amount: float, every_n: int) -> list[int]:
    random.seed(8675309 + every_n)
    output: list[int] = []

    for index, sample in enumerate(samples):
        if index % every_n == 0:
            noise = random.randint(-32768, 32767) * amount
            output.append(sample + int(noise))
        else:
            output.append(sample)

    return output


def bitcrush(samples: list[int], step: int) -> list[int]:
    return [round(sample / step) * step for sample in samples]


if __name__ == "__main__":
    raise SystemExit(main())
