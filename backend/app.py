"""
BioViewer — Flask backend
Calculs lourds déportés côté serveur : ORF finder, BLAST, traduction, export.
Le frontend React parse lui-même les fichiers locaux via Web Worker.
Ce backend est OPTIONNEL : l'app fonctionne sans lui (parsing côté client).
"""

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import os, json, subprocess, tempfile, threading
from io import StringIO

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://localhost:4173"]}})

# ─── Optional Biopython import ───────────────────────────────────────────────
try:
    from Bio import SeqIO
    from Bio.SeqRecord import SeqRecord
    from Bio.Seq import Seq
    from Bio.SeqFeature import SeqFeature, FeatureLocation
    HAS_BIOPYTHON = True
except ImportError:
    HAS_BIOPYTHON = False
    print("⚠  Biopython not installed — some endpoints will be limited. pip install biopython")


# ─── Health ──────────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "biopython": HAS_BIOPYTHON,
        "blast": _check_tool("blastn"),
        "muscle": _check_tool("muscle"),
    })


# ─── Parse (large server-side files) ─────────────────────────────────────────
@app.route("/api/parse", methods=["POST"])
def parse_sequence():
    """
    Body: { "filepath": "/data/genome.fa" }  (fichier accessible côté serveur)
    Retourne méta + séquence (tronquée à 10Mb pour le display, index complet).
    """
    if not HAS_BIOPYTHON:
        return jsonify({"error": "Biopython not installed"}), 500

    data = request.get_json()
    filepath = data.get("filepath")
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404

    fmt = _detect_format(filepath)
    records = []
    try:
        for rec in SeqIO.parse(filepath, fmt):
            seq_str = str(rec.seq)
            records.append({
                "id": rec.id,
                "description": rec.description,
                "length": len(rec.seq),
                "gc": _gc_content(seq_str),
                "type": _detect_seq_type(seq_str),
                "sequence": seq_str[:10_000_000],   # 10 Mb max pour le client
                "truncated": len(rec.seq) > 10_000_000,
                "annotations": _extract_features(rec),
                "format": fmt,
            })
            if len(records) >= 50:   # max 50 records par appel
                break
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"records": records, "count": len(records)})


# ─── Analyze ─────────────────────────────────────────────────────────────────
@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Body: { "sequence": "ATGC…", "tasks": ["gc", "orfs", "translate", "cpg"] }
    """
    data = request.get_json()
    seq = data.get("sequence", "").upper().replace(" ", "").replace("\n", "")
    tasks = data.get("tasks", ["gc", "orfs"])
    min_orf = data.get("min_orf", 100)
    result = {}

    if "gc" in tasks:
        result["gc"] = _gc_content(seq)
        result["composition"] = {n: seq.count(n) / len(seq) * 100 if seq else 0 for n in "ATGCN"}

    if "orfs" in tasks:
        result["orfs"] = _find_orfs(seq, min_orf)

    if "translate" in tasks:
        result["translations"] = {}
        for frame in range(3):
            result["translations"][f"+{frame+1}"] = _translate(seq[frame:])
        rc = _reverse_complement(seq)
        for frame in range(3):
            result["translations"][f"-{frame+1}"] = _translate(rc[frame:])

    if "cpg" in tasks:
        result["cpg_islands"] = _find_cpg_islands(seq)

    if "motif" in tasks:
        motif = data.get("motif", "")
        result["motif_hits"] = _find_motif(seq, motif)

    return jsonify(result)


# ─── Export ──────────────────────────────────────────────────────────────────
@app.route("/api/export", methods=["POST"])
def export_sequence():
    """
    Body: { "sequence": "…", "format": "fasta|genbank|fastq", "meta": {…}, "annotations": […] }
    """
    data = request.get_json()
    seq_str = data.get("sequence", "")
    fmt = data.get("format", "fasta")
    meta = data.get("meta", {})
    annotations = data.get("annotations", [])

    if fmt == "fasta":
        lines = [f">{meta.get('id','seq')} {meta.get('description','')}".strip()]
        for i in range(0, len(seq_str), 60):
            lines.append(seq_str[i:i+60])
        content = "\n".join(lines)
        mimetype = "text/plain"
        filename = meta.get("id", "sequence") + ".fasta"

    elif fmt == "genbank" and HAS_BIOPYTHON:
        rec = SeqRecord(Seq(seq_str), id=meta.get("id","seq"), description=meta.get("description",""))
        for feat in annotations:
            loc = FeatureLocation(feat["start"], feat["end"]+1, strand=feat.get("strand", 1))
            sf = SeqFeature(loc, type=feat["type"], qualifiers=feat.get("qualifiers", {}))
            rec.features.append(sf)
        buf = StringIO()
        SeqIO.write(rec, buf, "genbank")
        content = buf.getvalue()
        mimetype = "text/plain"
        filename = meta.get("id", "sequence") + ".gb"

    elif fmt == "gff3":
        lines = ["##gff-version 3"]
        seqid = meta.get("id", ".")
        for feat in annotations:
            attrs = ";".join(f"{k}={v}" for k, v in feat.get("qualifiers", {}).items())
            lines.append("\t".join([
                seqid,
                feat.get("source", "BioViewer"),
                feat["type"],
                str(feat["start"] + 1),
                str(feat["end"] + 1),
                str(feat.get("score", ".")),
                "-" if feat.get("strand") == -1 else "+",
                str(feat.get("phase", ".")),
                attrs or f"ID={feat.get('id','.')}",
            ]))
        content = "\n".join(lines)
        mimetype = "text/plain"
        filename = meta.get("id", "sequence") + ".gff3"
    else:
        return jsonify({"error": f"Unsupported format: {fmt}"}), 400

    return Response(
        content,
        mimetype=mimetype,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ─── BLAST (optionnel, nécessite BLAST+ installé) ────────────────────────────
@app.route("/api/blast", methods=["POST"])
def run_blast():
    """
    Body: { "sequence": "…", "db": "nr|nt|local_db_path", "program": "blastn|blastp", "evalue": 0.001 }
    """
    if not _check_tool("blastn"):
        return jsonify({"error": "BLAST+ not installed or not in PATH"}), 500

    data = request.get_json()
    seq = data.get("sequence", "")
    db = data.get("db", "nt")
    program = data.get("program", "blastn")
    evalue = data.get("evalue", 0.001)
    max_hits = data.get("max_hits", 10)

    if not seq:
        return jsonify({"error": "No sequence provided"}), 400

    with tempfile.NamedTemporaryFile(mode="w", suffix=".fa", delete=False) as f:
        f.write(f">query\n{seq}\n")
        query_path = f.name

    try:
        result = subprocess.run(
            [program, "-query", query_path, "-db", db,
             "-evalue", str(evalue), "-max_target_seqs", str(max_hits),
             "-outfmt", "15",   # JSON output
             "-num_threads", "4"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            return jsonify({"error": result.stderr}), 500
        blast_data = json.loads(result.stdout)
        return jsonify({"blast": blast_data})
    except subprocess.TimeoutExpired:
        return jsonify({"error": "BLAST timeout (120s)"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(query_path)


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _gc_content(seq):
    if not seq: return 0
    return round((seq.count("G") + seq.count("C")) / len(seq) * 100, 2)

def _detect_seq_type(seq):
    s = seq.upper()[:500]
    if any(c in s for c in "EFILPQZ"): return "protein"
    if "U" in s: return "RNA"
    return "DNA"

def _detect_format(path):
    ext = path.rsplit(".", 1)[-1].lower()
    return {"fa": "fasta", "fasta": "fasta", "fq": "fastq", "fastq": "fastq",
            "gb": "genbank", "gbk": "genbank", "genbank": "genbank"}.get(ext, "fasta")

def _extract_features(rec):
    feats = []
    if not HAS_BIOPYTHON: return feats
    color_map = {
        "gene": "#3fb950", "mRNA": "#58a6ff", "CDS": "#f78166",
        "exon": "#e3b341", "intron": "#484f58", "misc_feature": "#8b949e",
        "rRNA": "#4ac26b", "tRNA": "#56d364", "regulatory": "#ffa657",
    }
    for feat in getattr(rec, "features", []):
        if feat.type == "source": continue
        feats.append({
            "id": feat.qualifiers.get("locus_tag", [feat.type])[0],
            "type": feat.type,
            "start": int(feat.location.start),
            "end": int(feat.location.end) - 1,
            "strand": feat.location.strand,
            "qualifiers": {k: v[0] if isinstance(v, list) else v for k, v in feat.qualifiers.items()},
            "color": color_map.get(feat.type, "#8b949e"),
        })
    return feats

CODON_TABLE = {
    "TTT":"F","TTC":"F","TTA":"L","TTG":"L","CTT":"L","CTC":"L","CTA":"L","CTG":"L",
    "ATT":"I","ATC":"I","ATA":"I","ATG":"M","GTT":"V","GTC":"V","GTA":"V","GTG":"V",
    "TCT":"S","TCC":"S","TCA":"S","TCG":"S","CCT":"P","CCC":"P","CCA":"P","CCG":"P",
    "ACT":"T","ACC":"T","ACA":"T","ACG":"T","GCT":"A","GCC":"A","GCA":"A","GCG":"A",
    "TAT":"Y","TAC":"Y","TAA":"*","TAG":"*","CAT":"H","CAC":"H","CAA":"Q","CAG":"Q",
    "AAT":"N","AAC":"N","AAA":"K","AAG":"K","GAT":"D","GAC":"D","GAA":"E","GAG":"E",
    "TGT":"C","TGC":"C","TGA":"*","TGG":"W","CGT":"R","CGC":"R","CGA":"R","CGG":"R",
    "AGT":"S","AGC":"S","AGA":"R","AGG":"R","GGT":"G","GGC":"G","GGA":"G","GGG":"G",
}

def _translate(seq):
    protein = []
    for i in range(0, len(seq) - 2, 3):
        codon = seq[i:i+3]
        aa = CODON_TABLE.get(codon, "X")
        protein.append(aa)
        if aa == "*": break
    return "".join(protein)

def _reverse_complement(seq):
    comp = str.maketrans("ATGCUN", "TACGAN")
    return seq.translate(comp)[::-1]

def _find_orfs(seq, min_len=100):
    orfs = []
    for frame in range(3):
        start = None
        for i in range(frame, len(seq) - 2, 3):
            codon = seq[i:i+3]
            if codon == "ATG" and start is None:
                start = i
            if codon in ("TAA", "TAG", "TGA") and start is not None:
                if i - start >= min_len:
                    orfs.append({"start": start, "end": i+2, "frame": frame+1,
                                 "strand": 1, "length": i - start + 3,
                                 "protein": _translate(seq[start:i+3])})
                start = None
    rc = _reverse_complement(seq)
    for frame in range(3):
        start = None
        for i in range(frame, len(rc) - 2, 3):
            codon = rc[i:i+3]
            if codon == "ATG" and start is None:
                start = i
            if codon in ("TAA", "TAG", "TGA") and start is not None:
                if i - start >= min_len:
                    rs = len(seq) - (i + 3)
                    re = len(seq) - start - 1
                    orfs.append({"start": rs, "end": re, "frame": -(frame+1),
                                 "strand": -1, "length": i - start + 3,
                                 "protein": _translate(rc[start:i+3])})
                start = None
    return sorted(orfs, key=lambda x: x["start"])

def _find_cpg_islands(seq, window=200, step=50, gc_thresh=50, cpg_thresh=0.6):
    islands = []
    for i in range(0, len(seq) - window, step):
        chunk = seq[i:i+window]
        gc = _gc_content(chunk)
        cpg_obs = chunk.count("CG")
        cpg_exp = (chunk.count("C") * chunk.count("G")) / len(chunk) if len(chunk) else 0
        ratio = cpg_obs / cpg_exp if cpg_exp > 0 else 0
        if gc >= gc_thresh and ratio >= cpg_thresh:
            islands.append({"start": i, "end": i + window, "gc": gc, "cpg_ratio": round(ratio, 2)})
    # Merge overlapping
    merged = []
    for isl in islands:
        if merged and isl["start"] <= merged[-1]["end"]:
            merged[-1]["end"] = max(merged[-1]["end"], isl["end"])
        else:
            merged.append(isl)
    return merged

def _find_motif(seq, motif):
    if not motif: return []
    hits = []
    m = motif.upper()
    idx = 0
    while idx < len(seq):
        pos = seq.find(m, idx)
        if pos == -1: break
        hits.append({"start": pos, "end": pos + len(m) - 1})
        idx = pos + 1
    return hits

def _check_tool(name):
    try:
        subprocess.run([name, "-version"], capture_output=True, timeout=3)
        return True
    except:
        return False


if __name__ == "__main__":
    print("🧬 BioViewer backend starting on http://localhost:5000")
    print(f"   Biopython: {'✓' if HAS_BIOPYTHON else '✗ (pip install biopython)'}")
    app.run(debug=True, port=5000, threaded=True)
