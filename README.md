# albarans-codiba

Eina per digitalitzar albarans PDF de CODIBA (el distribuïdor de begudes de
la Festa Major) i abocar-ne les dades a un Google Sheets: una fila per
albarà a la pestanya **Albarans**, i una fila per línia de producte a la
pestanya **Linies**.

Pensada per fer-se servir un a un dins de Claude Code amb la skill
`albara-to-sheet`: li dones la ruta d'un PDF i ell llegeix, extreu les dades
i les escriu al Sheet.

## Configuració (un sol cop)

### 1. Crea un compte de servei de Google

1. Vés a [console.cloud.google.com](https://console.cloud.google.com),
   crea (o reutilitza) un projecte.
2. Activa l'API **Google Sheets API** per aquest projecte
   (APIs & Services → Enable APIs → cerca "Google Sheets API" → Enable).
3. Ves a **IAM & Admin → Service Accounts → Create Service Account**.
   Posa-li un nom (p.ex. `albarans-codiba`) i crea'l (no cal donar-li cap
   rol de projecte).
4. Dins del compte de servei creat, pestanya **Keys → Add Key → Create new
   key → JSON**. Es descarregarà un fitxer `.json`.
5. Copia aquest fitxer a l'arrel d'aquest projecte com `service_account.json`.
   (Aquest fitxer conté una credencial sensible — no el pugis mai a git;
   el `.gitignore` ja l'exclou.)

### 2. Crea el Google Sheet i comparteix-lo

1. Crea un Google Sheets nou (o fes servir un existent) on vulguis que
   arribin les dades.
2. Obre `service_account.json` i copia el valor del camp `client_email`
   (té una pinta com `albarans-codiba@el-teu-projecte.iam.gserviceaccount.com`).
3. Al Google Sheet, **Comparteix** → enganxa aquest email → dona-li permís
   d'**Editor**.
4. Copia l'ID del Sheet (la part de la URL entre `/d/` i `/edit`):
   `https://docs.google.com/spreadsheets/d/AQUEST_ID_AQUI/edit`

### 3. Configura el projecte

```bash
cd albarans-codiba
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp config.example.json config.json
```

Edita `config.json` i posa-hi el `sheet_id` del pas anterior (i el nom del
fitxer de credencials si li has posat un altre nom).

## Ús

Dins d'una sessió de Claude Code oberta en aquest directori:

> Passa'm l'albarà `~/Downloads/26-26659 - DISSABTE NIT BLANCA OLIVERES.pdf` al Sheets

Claude farà servir la skill `albara-to-sheet`: llegirà el PDF, n'extraurà
capçalera + línies + totals, i cridarà `push_to_sheet.py` per escriure-ho.

També pots cridar l'script manualment si ja tens el JSON preparat:

```bash
python3 push_to_sheet.py ruta/al/json_extret.json
```

## Estructura del Sheet

- **Albarans**: una fila per document (Data, Albarà, Càrrega, Xofer,
  F.Pag., Comercial, dades del client, observacions, total de bultos,
  totals d'IVA i total a pagar). Un mateix PDF pot generar més d'una fila
  si conté diverses còpies/versions de l'albarà — es marquen totes, no
  s'intenta triar automàticament quina és la definitiva.
- **Linies**: una fila per producte de cada albarà (codi, denominació,
  quantitat, preu, descomptes, import net, IVA), incloses les línies amb
  quantitat negativa (devolucions).

## Notes

- El parsing del PDF el fa Claude en llegir el document (no hi ha cap
  llibreria de PDF-parsing al codi): és robust a maquetacions una mica
  irregulars, però revisa sempre les dades escrites al Sheet la primera
  vegada que facis servir un albarà nou o diferent dels habituals.
- Si un PDF té pàgines amb anotacions manuscrites, digues-ho a Claude
  perquè no les confongui amb el text imprès.
