"""Estrae dal PDF catalogo le 4 famiglie beta: ritagli reali dei campioni, colore medio, codici (letti dal PDF)."""
import json, sys
from pathlib import Path
import numpy as np
import pymupdf
from PIL import Image
from scipy import ndimage

PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/app/reference/materiali album (1).pdf')
OUT = Path(__file__).parent / 'assets'
OUT.mkdir(exist_ok=True)

# Ordine di lettura riga per riga (alto→basso, sinistra→destra) dei campioni presenti nel PDF.
# Nessun codice inventato: solo quelli stampati nelle pagine indicate.
PAGES = {
    'CORTECCIA': [
        (1, ['C12', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C13', 'C14', 'C15', 'C16']),
        (2, ['C18', 'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30']),
    ],
    'TELA': [
        (4, ['T122', 'T110', 'T111', 'T112', 'T113', 'T114', 'T115', 'T116', 'T117', 'T118', 'T119', 'T120', 'T121', 'T123', 'T124']),
    ],
    'ECO LISCIO': [
        (13, ['EL400', 'EL402', 'EL403', 'EL404', 'EL405', 'EL406', 'EL407', 'EL408', 'EL409', 'EL410', 'EL411', 'EL412', 'EL413', 'EL414', 'EL415', 'EL416', 'EL417', 'EL418', 'EL419']),
        (14, ['EL420', 'EL423', 'EL424', 'EL425', 'EL426', 'EL427', 'EL428', 'EL429', 'EL430', 'EL431']),
    ],
    'VELLUTINO': [
        (30, ['V1550', 'V1551', 'V1552', 'V1553', 'V1554', 'V1555', 'V1556', 'V1557', 'V1558', 'V1559', 'V1560', 'V1561', 'V1562', 'V1563', 'V1564', 'V1565', 'V1566', 'V1567', 'V1568', 'V1569']),
    ],
}
OUT_OF_PRODUCTION = {'T114'}
LARGE_SAMPLE = {'CORTECCIA': 'C12', 'TELA': 'T122', 'ECO LISCIO': 'EL420', 'VELLUTINO': 'V1551'}
FAMILY_IDS = {'CORTECCIA': 'corteccia', 'TELA': 'tela', 'ECO LISCIO': 'eco-liscio', 'VELLUTINO': 'vellutino'}


def boxes(page, dpi=200):
    pix = page.get_pixmap(dpi=dpi)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    a = np.asarray(img).astype(int)
    # non-bianco: il campione (anche bianco, ~245) e le ombre; il testo viene filtrato per area
    mask = a.min(axis=2) < 251
    lab, n = ndimage.label(mask)
    found = []
    for sl in ndimage.find_objects(lab):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if w < 150 or h < 90:
            continue
        y0, x0, y1, x1 = sl[0].start, sl[1].start, sl[0].stop, sl[1].stop
        # taglia l'etichetta di testo eventualmente unita sotto il campione
        rows = mask[y0:y1, x0:x1].mean(axis=1)
        dense = np.where(rows > 0.6)[0]
        y1 = y0 + int(dense.max()) + 1
        y0 = y0 + int(dense.min())
        found.append((y0, x0, y1, x1))
    # raggruppa per riga (tolleranza 40px) poi ordina per x
    found.sort(key=lambda b: b[0])
    rows_out, current = [], []
    for b in found:
        if current and abs(b[0] - current[0][0]) > 40:
            rows_out.append(sorted(current, key=lambda r: r[1])); current = []
        current.append(b)
    if current: rows_out.append(sorted(current, key=lambda r: r[1]))
    return img, [b for r in rows_out for b in r]


def main():
    doc = pymupdf.open(PDF)
    families, variants, report = [], [], []
    for fam, pages in PAGES.items():
        fid = FAMILY_IDS[fam]
        families.append({'id': fid, 'name': fam, 'textureUrl': f'/api/assets/catalog/{fid}_texture.jpg', 'source': 'materiali album.pdf'})
        for pno, codes in pages:
            img, bx = boxes(doc[pno - 1])
            if len(bx) != len(codes):
                report.append(f'{fam} pag.{pno}: trovati {len(bx)} campioni, attesi {len(codes)} — verificare')
            # il campione grande (colonna sinistra) viene prima nel PDF: ordina per colonna x quando x0 è a sinistra
            left = [b for b in bx if b[1] < img.width * 0.3]
            right = [b for b in bx if b[1] >= img.width * 0.3]
            ordered = left + right
            for code, (y0, x0, y1, x1) in zip(codes, ordered):
                crop = img.crop((x0 + 6, y0 + 6, x1 - 6, y1 - 6))
                out_of_prod = code in OUT_OF_PRODUCTION
                mean = np.asarray(crop).reshape(-1, 3).mean(axis=0)
                hexcol = '#%02x%02x%02x' % tuple(int(v) for v in mean)
                sw = crop.copy(); sw.thumbnail((240, 240))
                sw.save(OUT / f'{code}.jpg', quality=85)
                variants.append({'code': code, 'familyId': fid, 'name': f'{fam} {code}', 'colorHex': None if out_of_prod else hexcol,
                                 'swatchUrl': f'/api/assets/catalog/{code}.jpg', 'outOfProduction': out_of_prod, 'pdfPage': pno})
                if code == LARGE_SAMPLE[fam]:
                    crop.save(OUT / f'{fid}_texture.jpg', quality=90)
    json.dump({'families': families, 'variants': variants, 'report': report}, open(Path(__file__).parent / 'catalog.json', 'w'), indent=1, ensure_ascii=False)
    print(len(families), 'famiglie', len(variants), 'varianti'); print('\n'.join(report) or 'nessuna anomalia')


if __name__ == '__main__':
    main()
