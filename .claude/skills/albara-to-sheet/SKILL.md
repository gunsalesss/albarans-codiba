---
name: albara-to-sheet
description: Digitalitza un albarà PDF de CODIBA (comercial distribuïdora de begudes) i n'escriu les dades a un Google Sheets. Fes servir aquesta skill quan l'usuari doni la ruta d'un PDF d'albarà de CODIBA i vulgui passar-lo al full de càlcul.
---

# Albarà CODIBA → Google Sheets

Aquesta skill llegeix un PDF d'albarà de CODIBA (el distribuïdor de begudes),
n'extreu les dades estructurades i les envia, via HTTP POST, al Web App de
Google Apps Script (`src/Code.gs`), que crea **una pestanya nova** al
Google Sheet (amb el nom del fitxer PDF, sense l'extensió) amb: una
capçalera compartida (Albarà, Data, Client...) un sol cop, **una única
taula d'ítems sense interrupcions** (totes les línies de tots els
documents del PDF, etiquetades amb la seva columna "Pàgines"), i al final
(mai enmig) una taula-resum amb els totals de cada document.

## Pas 1 — Comprovar la configuració

Comprova que existeix `webapp.json` a l'arrel del projecte
(`albarans-codiba/webapp.json`, gitignored). Si no existeix, atura't i
indica a l'usuari que segueixi el `README.md` per desplegar el Web App
d'Apps Script i crear aquest fitxer amb la URL. No continuïs sense això.

`webapp.json` té aquesta forma (`sheet_id` és opcional — si hi és, s'envia
a cada petició; el Web App el desa el primer cop i, a partir d'aleshores,
ja no caldria ni enviar-lo):
```json
{
  "url": "https://script.google.com/macros/s/AKfycb.../exec",
  "sheet_id": "EL_ID_DEL_GOOGLE_SHEET"
}
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

## Pas 2b — Detecta i descarta documents duplicats

CODIBA sovint imprimeix **dues còpies físiques amb exactament les mateixes
dades** del mateix moment (p.ex. còpia del xofer i còpia del client en el
moment de l'entrega/recollida, abdues signades o amb les mateixes ratlles
de verificació). Això NO és el mateix cas que la còpia "final" amb
devolucions ja aplicades (aquesta sí que té dades diferents i s'ha de
mantenir sempre).

Abans de construir el payload, compara cada parella de documents extrets
del mateix PDF. Considera'ls **duplicats** només si TOTS aquests punts
coincideixen:
- Mateix `total_bultos` i mateix `total_a_pagar`.
- Mateixes línies: mateixos codis amb les mateixes quantitats (`quant`) i
  el mateix `import_net` per línia (petites diferències de lectura
  manuscrita no compten com a diferència real si els valors impresos són
  idèntics).

Si dos documents són duplicats:
- Conserva'n **només un** al payload final (`documents`) — tria el que
  tingui més informació llegible (per exemple, si un té anotacions
  manuscrites il·legibles i l'altre no, queda't amb el que no en té).
- A l'`observacions` del document conservat, afegeix una nota breu
  indicant que hi havia una còpia duplicada i a quines pàgines
  (p.ex. "Còpia duplicada també present a pàgines 6-7, mateixes dades.").
- Mai descartis un document que tingui `total_bultos` o `total_a_pagar`
  diferent (típicament la versió amb devolucions/ajustos ja aplicats):
  aquesta sempre s'ha de conservar com a document separat.

## Pas 3 — Enviar les dades al Web App

1. Llegeix `webapp.json` per obtenir `url` (i `sheet_id` si hi és).
2. Construeix el payload: `{"sheet_id": "<sheet_id si hi és>", "pdf_origen": "<nom del fitxer PDF>", "documents": [...]}`.
3. Desa'l a un fitxer temporal (usa el scratchpad de la sessió) i envia'l.
   **Important**: Apps Script sempre respon amb un redirect 302 a
   `script.googleusercontent.com`; fer `curl -s -L` en una sola crida a
   vegades falla de forma intermitent, així que és més fiable capturar la
   `Location` i fer-hi una segona petició explícita:
   ```bash
   curl -s -D /tmp/headers.txt -X POST -H "Content-Type: application/json" \
     --data @/path/al/payload.json \
     "<url>" > /dev/null
   LOCATION=$(grep -i '^location:' /tmp/headers.txt | sed 's/^[Ll]ocation: //' | tr -d '\r')
   curl -s "$LOCATION"
   ```
4. Comprova la resposta JSON (`{"ok": true, "pestanya": "<nom>", "documents_escrits": N, "linies_escrites": M}`).
   Si torna `{"error": ...}`, mostra'l a l'usuari sense inventar cap solució.
5. Mostra a l'usuari el resum (nom de la pestanya creada), i si hi havia
   més d'un document dins del mateix PDF, avisa'l explícitament perquè
   sàpiga que ha de revisar quin és vàlid dins d'aquella pestanya.

## Errors habituals

- Si la resposta és `{"error": "Falta 'sheet_id'..."}`: falta `sheet_id`
  a `webapp.json` o al payload (o cal executar `setup_()` des de l'editor,
  veure README).
- Si `curl` retorna una pàgina HTML de login/error de Google en lloc de
  JSON: torna-ho a provar seguint el mètode de dues peticions del Pas 3
  (el redirect intermedi és fiable, la crida directa amb `-L` no sempre).
- Si el nom de pestanya ja existeix al Sheet, el Web App n'hi afegeix un
  de nou amb un sufix `(2)`, `(3)`... — no sobreescriu mai una pestanya
  existent.
- Si el PDF ve escanejat/torçat i el text no es llegeix bé amb prou
  confiança, no inventis xifres: indica a l'usuari quins camps no has pogut
  llegir amb seguretat perquè els verifiqui.
