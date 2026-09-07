---
name: albara-to-sheet
description: Digitalitza un albarà PDF de CODIBA (comercial distribuïdora de begudes) i n'escriu les dades a un Google Sheets. Fes servir aquesta skill quan l'usuari doni la ruta d'un PDF d'albarà de CODIBA i vulgui passar-lo al full de càlcul.
---

# Albarà CODIBA → Google Sheets

Aquesta skill llegeix un PDF d'albarà de CODIBA (el distribuïdor de begudes),
n'extreu les dades estructurades i les envia, via HTTP POST, al Web App de
Google Apps Script (`src/Code.gs`) que les escriu al Google Sheet.

## Pas 1 — Comprovar la configuració

Comprova que existeix `webapp.json` a l'arrel del projecte
(`albarans-codiba/webapp.json`, gitignored). Si no existeix, atura't i
indica a l'usuari que segueixi el `README.md` per desplegar el Web App
d'Apps Script i crear aquest fitxer amb la URL. No continuïs sense això.

`webapp.json` té aquesta forma:
```json
{ "url": "https://script.google.com/macros/s/AKfycb.../exec" }
```

## Pas 2 — Llegir el PDF

Fes servir l'eina Read sobre el PDF que indiqui l'usuari. El PDF pot tenir
diverses pàgines i, de vegades, conté **més d'un "document" imprès** (per
exemple: una còpia inicial de la comanda sencera, i després una còpia amb
ajustos/devolucions ja aplicats, o una còpia amb anotacions a mà). Tracta
**cada bloc que comenci amb la capçalera (Data/Albarà/Xofer...) i acabi amb
un peu "Total Bultos" + taula IMP.SERV.** com un document independent.
No decideixis tu quin és el "definitiu": extreu-los TOTS per no perdre
informació, i deixa que l'usuari els reconciliï al Sheet si cal.

Per cada document, extreu aquest JSON:

```json
{
  "albara": "AL26-26659",
  "pagines": "1-2",
  "signat": false,
  "data": "29/08/26",
  "carrega": "CAR26-008713",
  "xofer": "124",
  "fpag": "FESTES",
  "comercial": "23",
  "client": {
    "n_com": "COLLA BLANCS GRANOLLERS",
    "titular": "COLLA BLANCS GRANOLLERS",
    "adreca": "AV PRAT DE LA RIBA 79",
    "poblacio": "08400-GRANOLLERS",
    "codi": "15654",
    "nif": "V60625548",
    "telefon": "636917688/608107212"
  },
  "observacions": "DISSABTE NIT BLANCA\nOLIVERAS 16:00H\nJULIA 647 823 876\nRECOLLIDA 30/08/26 4:00H",
  "linies": [
    {"codi": "01014", "unit": 1, "denominacio": "ESTRELLA DAMM BARRIL 30L", "quant": 19, "preu": 129.20, "dte": 66.66, "ibee": null, "punt_verd": null, "import_net": 1188.26, "iva": 21}
  ],
  "total_bultos": 43,
  "totals": [
    {"base_imposable": 17.54, "iva": 10, "quota_iva": 1.75},
    {"base_imposable": 669.06, "iva": 21, "quota_iva": 140.50}
  ],
  "total_a_pagar": 828.85
}
```

Notes sobre camps concrets:
- `pagines`: rang de pàgines del PDF d'origen que formen aquest document (p.ex. "1-2" o "3").
- `signat`: `true` si a la zona "CONFORME CLIENT" hi ha una signatura dibuixada.
- `linies`: una entrada per fila de producte de la taula, **incloses les línies
  amb quantitat negativa** (devolucions/ajustos — són línies vàlides, no les
  descartis). Ignora les línies "Suma y Sigue" (no són un producte, són un
  subtotal de continuació entre pàgines).
- Camps opcionals buits a la taula (Dte, IBEE, Punt Verd) → `null`, no `0`.
- `client.n_com` i `client.titular` solen coincidir; si difereixen, guarda
  els dos igualment.
- `totals`: una entrada per cada tipus d'IVA que aparegui al peu (normalment
  10% i 21%).

## Pas 3 — Enviar les dades al Web App

1. Llegeix `webapp.json` per obtenir `url`.
2. Construeix el payload: `{"pdf_origen": "<nom del PDF>", "documents": [...]}`.
3. Desa'l a un fitxer temporal (usa el scratchpad de la sessió) i envia'l amb:
   ```bash
   curl -s -X POST -H "Content-Type: application/json" \
     --data @/path/al/payload.json \
     "<url>"
   ```
4. Comprova la resposta JSON (`{"ok": true, "albarans_escrits": N, "linies_escrites": M}`).
   Si torna `{"error": ...}`, mostra'l a l'usuari sense inventar cap solució.
5. Mostra a l'usuari el resum, i si hi havia més d'un document dins del
   mateix PDF, avisa'l explícitament perquè sàpiga que ha de revisar quin
   és vàlid.

## Errors habituals

- Si la resposta és `{"error": "SHEET_ID no configurat..."}`: cal executar
  `setup_()` un cop des de l'editor d'Apps Script (veure README).
- Si `curl` retorna una pàgina HTML de login de Google en lloc de JSON: el
  desplegament del Web App no té l'accés configurat com "Anyone" — revisa
  el desplegament (Deploy → Manage deployments) al README.
- Si el PDF ve escanejat/torçat i el text no es llegeix bé amb prou
  confiança, no inventis xifres: indica a l'usuari quins camps no has pogut
  llegir amb seguretat perquè els verifiqui.
