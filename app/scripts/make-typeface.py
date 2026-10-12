"""Convert a .woff2/.ttf font to three.js typeface JSON (for drei <Text3D> / TextGeometry).

Usage: python3 -I scripts/make-typeface.py <font.woff2> <out.json>
Only printable ASCII (32-126) is exported. Needs fontTools + brotli.
"""
import json
import sys

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont


class TypefacePen(BasePen):
    """Records outlines in three.js typeface command syntax (m/l/q/b, y up, font units)."""

    def __init__(self, glyphset):
        super().__init__(glyphset)
        self.cmds = []

    def _moveTo(self, p):
        self.cmds += ['m', round(p[0]), round(p[1])]

    def _lineTo(self, p):
        self.cmds += ['l', round(p[0]), round(p[1])]

    def _qCurveToOne(self, p1, p2):
        # three.js typeface: q <end x> <end y> <control x> <control y>
        self.cmds += ['q', round(p2[0]), round(p2[1]), round(p1[0]), round(p1[1])]

    def _curveToOne(self, p1, p2, p3):
        self.cmds += ['b', round(p3[0]), round(p3[1]), round(p1[0]), round(p1[1]), round(p2[0]), round(p2[1])]

    def _closePath(self):
        pass


def main(src, out):
    font = TTFont(src)
    glyphset = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font['hmtx']
    head = font['head']
    glyphs = {}
    for code in range(32, 127):
        name = cmap.get(code)
        if not name:
            continue
        pen = TypefacePen(glyphset)
        glyphset[name].draw(pen)
        glyphs[chr(code)] = {'ha': hmtx[name][0], 'o': ' '.join(str(c) for c in pen.cmds)}
    data = {
        'glyphs': glyphs,
        'familyName': font['name'].getDebugName(1),
        'ascender': font['hhea'].ascent,
        'descender': font['hhea'].descent,
        'underlinePosition': font['post'].underlinePosition,
        'underlineThickness': font['post'].underlineThickness,
        'boundingBox': {'xMin': head.xMin, 'yMin': head.yMin, 'xMax': head.xMax, 'yMax': head.yMax},
        'resolution': head.unitsPerEm,
        'original_font_information': {'format': 0, 'fontFamily': font['name'].getDebugName(1)},
        'cssFontWeight': 'bold',
        'cssFontStyle': 'normal',
    }
    with open(out, 'w') as f:
        json.dump(data, f, separators=(',', ':'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
