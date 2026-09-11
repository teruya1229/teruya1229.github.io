from PIL import Image, ImageDraw
from pathlib import Path

out = Path(r"C:\dev\bc-service\teruya1229-github-io\bc-field-tools\tests\fixtures")
out.mkdir(parents=True, exist_ok=True)


def draw_nameplate(im, text_lines):
    d = ImageDraw.Draw(im)
    d.rectangle([20, 20, im.width - 20, im.height - 20], outline=(20, 20, 20), width=3)
    d.rectangle([40, 40, im.width - 40, 160], fill=(245, 245, 245), outline=(0, 0, 0), width=2)
    y = 55
    for line in text_lines:
        d.text((55, y), line, fill=(10, 10, 10))
        y += 28
    d.text((55, 200), "MODEL: RAS-X28N  SERIAL: ABC123456", fill=(30, 30, 30))
    d.text((55, 230), "Voltage 200V  Main 40A  Branch 20A", fill=(30, 30, 30))
    return im


# IMG-1 general JPEG ~2-3MB
im = Image.new("RGB", (3000, 2250), (220, 230, 240))
draw_nameplate(im, ["Panel label", "AC power check"])
p = out / "img1-general.jpg"
im.save(p, "JPEG", quality=92, optimize=True)
print("IMG1", p.stat().st_size)

# IMG-2 JPEG 8MB+
p2 = out / "img2-large.jpg"
im2b = Image.new("RGB", (6000, 4500), (190, 200, 210))
draw_nameplate(im2b, ["Large JPEG", "over 8MB"])
px = im2b.load()
for y in range(0, im2b.height, 2):
    for x in range(0, im2b.width, 2):
        v = (x * 13 + y * 7) % 50
        px[x, y] = (180 + v, 190 + (v // 2), 200 + (v // 3))
im2b.save(p2, "JPEG", quality=97)
print("IMG2", p2.stat().st_size)

# IMG-3 PNG with transparency
im3 = Image.new("RGBA", (1600, 1200), (0, 0, 0, 0))
d = ImageDraw.Draw(im3)
d.ellipse([200, 200, 1400, 1000], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=4)
d.text((500, 520), "Alpha PNG plate 200V", fill=(0, 0, 0, 255))
p3 = out / "img3-alpha.png"
im3.save(p3, "PNG")
print("IMG3", p3.stat().st_size)

# IMG-4 WebP
im4 = Image.new("RGB", (2000, 1500), (235, 240, 245))
draw_nameplate(im4, ["WebP photo", "test"])
p4 = out / "img4.webp"
im4.save(p4, "WEBP", quality=90)
print("IMG4", p4.stat().st_size)

# IMG-6 / IMG-7 with EXIF orientation
try:
    import piexif

    exif6 = piexif.dump({"0th": {piexif.ImageIFD.Orientation: 6}})
    landscape = Image.new("RGB", (1600, 1200), (230, 235, 240))
    dl = ImageDraw.Draw(landscape)
    dl.rectangle([100, 100, 1500, 1100], outline=(0, 0, 0), width=4)
    dl.text((200, 150), "TOP-MARKER", fill=(200, 0, 0))
    dl.text((1200, 900), "BOTTOM", fill=(0, 0, 200))
    p6 = out / "img6-portrait-orient6.jpg"
    landscape.save(p6, "JPEG", quality=90, exif=exif6)
    print("IMG6", p6.stat().st_size)

    exif8 = piexif.dump({"0th": {piexif.ImageIFD.Orientation: 8}})
    landscape2 = Image.new("RGB", (1600, 1200), (240, 235, 230))
    dl2 = ImageDraw.Draw(landscape2)
    dl2.text((100, 100), "ORIENT-8-TOP", fill=(180, 0, 0))
    dl2.text((100, 1000), "ORIENT-8-BOTTOM", fill=(0, 0, 180))
    p7 = out / "img7-orient8.jpg"
    landscape2.save(p7, "JPEG", quality=90, exif=exif8)
    print("IMG7", p7.stat().st_size)
except Exception as e:
    print("EXIF fixtures fallback", e)
    im6 = Image.new("RGB", (1200, 1600), (230, 235, 240))
    d = ImageDraw.Draw(im6)
    d.text((200, 200), "TOP-MARKER", fill=(200, 0, 0))
    d.text((200, 1400), "BOTTOM-MARKER", fill=(0, 0, 200))
    im6.save(out / "img6-portrait.jpg", "JPEG", quality=90)
    im6.save(out / "img7-orient8.jpg", "JPEG", quality=90)

# IMG-8 high res
im8 = Image.new("RGB", (8000, 6000), (210, 215, 220))
d = ImageDraw.Draw(im8)
d.rectangle([100, 100, 7900, 5900], outline=(0, 0, 0), width=8)
d.rectangle([200, 200, 3000, 900], fill=(250, 250, 250), outline=(0, 0, 0), width=4)
d.text((250, 250), "HIGHRES NAMEPLATE RAS-Z40N 200V 40A", fill=(0, 0, 0))
d.text((250, 350), "SERIAL ZX-9988776655", fill=(0, 0, 0))
p8 = out / "img8-highres.jpg"
im8.save(p8, "JPEG", quality=85, optimize=True)
print("IMG8", p8.stat().st_size)

# IMG-9 small nameplate text
im9 = Image.new("RGB", (2400, 1800), (180, 180, 180))
d = ImageDraw.Draw(im9)
d.rectangle([900, 700, 1500, 1100], fill=(250, 250, 245), outline=(0, 0, 0))
for i, line in enumerate(["MITSUBISHI", "MSZ-GE2218", "200V 15A", "R410A"]):
    d.text((920, 720 + i * 40), line, fill=(20, 20, 20))
p9 = out / "img9-nameplate.jpg"
im9.save(p9, "JPEG", quality=92)
print("IMG9", p9.stat().st_size)

# IMG-10 corrupt
p10 = out / "img10-corrupt.jpg"
p10.write_bytes(b"\xff\xd8\xff\xe0NOT_A_REAL_JPEG_PAYLOAD" + b"\x00" * 200)
print("IMG10", p10.stat().st_size)

heic = out / "sample.heic"
print("HEIC", heic.stat().st_size if heic.exists() else "missing")
print("done")
