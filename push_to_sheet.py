#!/usr/bin/env python3
"""Append parsed CODIBA albarà data (JSON) into a Google Sheet.

Usage:
    python push_to_sheet.py path/to/parsed_albara.json

Config is read from config.json (see config.example.json) in this same
directory, unless overridden by env vars ALBARANS_SHEET_ID /
ALBARANS_CREDENTIALS_PATH.
"""
import json
import os
import sys
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

ALBARANS_HEADERS = [
    "Data Importació", "PDF Origen", "Pàgines", "Signat",
    "Data", "Albarà", "Càrrega", "Xofer", "F.Pag.", "Comercial",
    "Client", "Codi Client", "NIF", "Adreça", "Població", "Telèfon",
    "Observacions", "Total Bultos", "Totals IVA (JSON)", "Total a Pagar",
]

LINIES_HEADERS = [
    "Albarà", "Pàgines", "Codi", "Unitat", "Denominació", "Quantitat",
    "Preu", "Dte", "IBEE", "Punt Verd", "Import Net", "IVA%",
]


def load_config():
    sheet_id = os.environ.get("ALBARANS_SHEET_ID")
    creds_path = os.environ.get("ALBARANS_CREDENTIALS_PATH")
    if sheet_id and creds_path:
        return sheet_id, creds_path

    config_path = os.path.join(SCRIPT_DIR, "config.json")
    if not os.path.exists(config_path):
        sys.exit(
            "Falta config.json (copia config.example.json a config.json i "
            "omple sheet_id i credentials_path), o defineix les variables "
            "d'entorn ALBARANS_SHEET_ID / ALBARANS_CREDENTIALS_PATH."
        )
    with open(config_path) as f:
        config = json.load(f)
    return sheet_id or config["sheet_id"], creds_path or config["credentials_path"]


def get_or_create_worksheet(sh, title, headers):
    try:
        ws = sh.worksheet(title)
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=title, rows=1000, cols=len(headers))
        ws.append_row(headers)
        return ws

    existing = ws.row_values(1)
    if not existing:
        ws.append_row(headers)
    return ws


def main():
    if len(sys.argv) != 2:
        sys.exit("Ús: python push_to_sheet.py path/to/parsed_albara.json")

    json_path = sys.argv[1]
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    documents = data.get("documents")
    if documents is None:
        # Allow passing a single document directly (no "documents" wrapper).
        documents = [data]

    pdf_origen = data.get("pdf_origen", os.path.basename(json_path))

    sheet_id, creds_path = load_config()
    if not os.path.isabs(creds_path):
        creds_path = os.path.join(SCRIPT_DIR, creds_path)

    creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(sheet_id)

    albarans_ws = get_or_create_worksheet(sh, "Albarans", ALBARANS_HEADERS)
    linies_ws = get_or_create_worksheet(sh, "Linies", LINIES_HEADERS)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    albarans_rows = []
    linies_rows = []

    for doc in documents:
        client = doc.get("client", {})
        albara = doc.get("albara", "")
        pagines = doc.get("pagines", "")

        albarans_rows.append([
            now,
            pdf_origen,
            pagines,
            "Sí" if doc.get("signat") else "",
            doc.get("data", ""),
            albara,
            doc.get("carrega", ""),
            doc.get("xofer", ""),
            doc.get("fpag", ""),
            doc.get("comercial", ""),
            client.get("titular", client.get("n_com", "")),
            client.get("codi", ""),
            client.get("nif", ""),
            client.get("adreca", ""),
            client.get("poblacio", ""),
            client.get("telefon", ""),
            doc.get("observacions", ""),
            doc.get("total_bultos", ""),
            json.dumps(doc.get("totals", []), ensure_ascii=False),
            doc.get("total_a_pagar", ""),
        ])

        for li in doc.get("linies", []):
            linies_rows.append([
                albara,
                pagines,
                li.get("codi", ""),
                li.get("unit", ""),
                li.get("denominacio", ""),
                li.get("quant", ""),
                li.get("preu", ""),
                li.get("dte", ""),
                li.get("ibee", ""),
                li.get("punt_verd", ""),
                li.get("import_net", ""),
                li.get("iva", ""),
            ])

    if albarans_rows:
        albarans_ws.append_rows(albarans_rows, value_input_option="USER_ENTERED")
    if linies_rows:
        linies_ws.append_rows(linies_rows, value_input_option="USER_ENTERED")

    print(
        f"Escrites {len(albarans_rows)} fila(es) a 'Albarans' i "
        f"{len(linies_rows)} fila(es) a 'Linies'."
    )


if __name__ == "__main__":
    main()
