"""Draws the HullOps app icons: a white "H" on the app's blue.

Standard library only (no Pillow), so it runs anywhere:
    python3 scripts/generate-icons.py
Run from apps/web. The PNGs it writes are committed; rerun this only to
change the design.
"""

import struct
import zlib
from pathlib import Path

BLUE = (3, 105, 161)  # Tailwind sky-700, the app's accent colour
WHITE = (255, 255, 255)


def write_png(path: Path, size: int, letter_width: float, letter_height: float):
    """A square icon with a centred "H" taking the given share of its size."""
    w, h = letter_width * size, letter_height * size
    left, top = (size - w) / 2, (size - h) / 2
    bar = w * 0.3  # thickness of each vertical bar
    cross = h * 0.17  # thickness of the crossbar

    def is_letter(x: int, y: int) -> bool:
        if not (left <= x < left + w and top <= y < top + h):
            return False
        in_bar = x < left + bar or x >= left + w - bar
        in_cross = abs(y - (top + h / 2)) < cross / 2
        return in_bar or in_cross

    rows = bytearray()
    for y in range(size):
        rows.append(0)  # PNG filter type "none" for this row
        for x in range(size):
            rows.extend(WHITE if is_letter(x, y) else BLUE)

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )


icons = Path("public/icons")
# "any" icons: the letter fills most of the icon.
write_png(icons / "icon-192.png", 192, 0.5, 0.62)
write_png(icons / "icon-512.png", 512, 0.5, 0.62)
# Maskable: Android crops the icon to a circle or rounded shape, so the
# letter must stay inside the central 80% "safe zone".
write_png(icons / "icon-maskable-512.png", 512, 0.38, 0.48)
# iOS rounds the corners itself and uses this file name by Next.js convention.
write_png(Path("src/app/apple-icon.png"), 180, 0.5, 0.62)
