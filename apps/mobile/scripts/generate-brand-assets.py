"""Render the Pocket Engineer signal mark into app icons, splash and favicon.

Run with: uv run --with pillow python scripts/generate-brand-assets.py

Bar ratios mirror SIGNAL_BARS in src/components/brand/logo.tsx so the generated
images always match the mark drawn inside the app.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

INK = (8, 9, 11, 255)
CITRON = (200, 247, 81, 255)
SIGNAL_BARS = (0.38, 0.66, 1.0, 0.72, 0.44)
SUPERSAMPLE = 4

ASSETS = Path(__file__).resolve().parent.parent / "assets"
IMAGES = ASSETS / "images"


def draw_bars(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: tuple[int, ...]) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    bar_width = width * 0.116
    gap = (width - bar_width * len(SIGNAL_BARS)) / (len(SIGNAL_BARS) - 1)
    centre = top + height / 2
    for index, ratio in enumerate(SIGNAL_BARS):
        bar_left = left + index * (bar_width + gap)
        bar_height = height * ratio
        draw.rounded_rectangle(
            (bar_left, centre - bar_height / 2, bar_left + bar_width, centre + bar_height / 2),
            radius=bar_width / 2,
            fill=color,
        )


def render_mark(
    size: int,
    *,
    background: tuple[int, ...] | None,
    bar_color: tuple[int, ...],
    corner: float = 0.3,
    inset: float = 0.23,
) -> Image.Image:
    scale = size * SUPERSAMPLE
    canvas = Image.new("RGBA", (scale, scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    if background is not None:
        draw.rounded_rectangle((0, 0, scale - 1, scale - 1), radius=int(scale * corner), fill=background)
    pad = scale * inset
    draw_bars(draw, (int(pad), int(scale * 0.31), int(scale - pad), int(scale * 0.69)), bar_color)
    return canvas.resize((size, size), Image.LANCZOS)


def render_square(
    size: int,
    *,
    background: tuple[int, ...],
    bar_color: tuple[int, ...],
    inset: float = 0.2,
) -> Image.Image:
    """Full-bleed square used for store icons that add their own mask."""
    scale = size * SUPERSAMPLE
    canvas = Image.new("RGBA", (scale, scale), background)
    draw = ImageDraw.Draw(canvas)
    pad = scale * inset
    height = 0.5 - inset * 0.55
    draw_bars(draw, (int(pad), int(scale * (0.5 - height)), int(scale - pad), int(scale * (0.5 + height))), bar_color)
    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)

    render_square(1024, background=INK, bar_color=CITRON).save(IMAGES / "icon.png")
    render_square(1024, background=CITRON, bar_color=INK).save(IMAGES / "icon-light.png")

    # Android adaptive icon: foreground art on a transparent canvas, safe-zone inset.
    foreground = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    art = render_mark(560, background=None, bar_color=CITRON, inset=0.0)
    foreground.alpha_composite(art, (232, 232))
    foreground.save(IMAGES / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), INK).save(IMAGES / "android-icon-background.png")

    monochrome = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    monochrome.alpha_composite(render_mark(560, background=None, bar_color=(255, 255, 255, 255), inset=0.0), (232, 232))
    monochrome.save(IMAGES / "android-icon-monochrome.png")

    render_mark(512, background=None, bar_color=CITRON, inset=0.0).save(IMAGES / "splash-icon.png")

    favicon = render_square(256, background=INK, bar_color=CITRON, inset=0.13)
    favicon.save(IMAGES / "favicon.png")
    favicon.save(
        Path(__file__).resolve().parent.parent / "public" / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print("Wrote brand assets to", IMAGES)


if __name__ == "__main__":
    main()
