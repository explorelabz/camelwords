"""Render the app's original camel line mark as a native launcher icon."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
out = root / "assets"
out.mkdir(exist_ok=True)
scale = 3
size = 1024 * scale
image = Image.new("RGB", (size, size), "#387968")
draw = ImageDraw.Draw(image)

def point(p):
    return ((p[0] * 30 + 152) * scale, (p[1] * 30 + 152) * scale)

def curve(a, b, c, d):
    return [tuple((1-t)**3*a[i] + 3*(1-t)**2*t*b[i] + 3*(1-t)*t*t*c[i] + t**3*d[i] for i in (0, 1)) for t in [n/40 for n in range(41)]]

paths = [
    [(3,16),(3,11)] + curve((3,11),(3,7),(7,7),(8,11)) + curve((8,11),(10,6),(14,6),(16,11)) + [(18,7),(18,4),(21,4),(21,14),(18,14),(16,17),(6,17),(5,20)],
    [(16,17),(18,20)], [(8,17),(9,20)],
]
width = 44 * scale
for path in paths:
    pts = [point(p) for p in path]
    draw.line(pts, fill="#edf3dc", width=width, joint="curve")
    for x, y in (pts[0], pts[-1]):
        draw.ellipse((x-width/2,y-width/2,x+width/2,y+width/2),fill="#edf3dc")
image.resize((1024,1024), Image.Resampling.LANCZOS).save(out / "icon.png")
