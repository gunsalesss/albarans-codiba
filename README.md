# albarans-codiba

Eina per digitalitzar albarans PDF de CODIBA (el distribuïdor de begudes de
la Festa Major) i abocar-ne les dades a un Google Sheets: una fila per
albarà a la pestanya **Albarans**, i una fila per línia de producte a la
pestanya **Linies**.

Pensada per fer-se servir un a un dins de Claude Code amb la skill
`albara-to-sheet`: li dones la ruta d'un PDF i ell el llegeix, n'extreu les
dades i les envia a un petit Web App de **Google Apps Script** que les
escriu al Sheet. **100% gratuït** — Apps Script va lligat al teu compte de
Google normal, sense passar per Google Cloud Console ni activar cap
facturació (igual que el projecte `generador-fitxes-imbecils`).

## Configuració (un sol cop)

### 1. Instal·la `clasp` si no el tens

```bash
npm install -g @google/clasp
clasp login
```

Això obre el navegador perquè autoritzis `clasp` amb el teu compte de
Google normal — cap consola de Cloud, cap targeta.

### 2. Crea el projecte d'Apps Script

```bash
cd albarans-codiba
clasp create --type webapp --title "Albarans CODIBA" --rootDir src
clasp push
```

Això substituirà `.clasp.json` pel `scriptId` real del teu projecte.

### 3. Desplega'l com a Web App

```bash
clasp open
```

A l'editor d'Apps Script que s'obre al navegador:
1. **Deploy → New deployment**.
2. Tipus: **Web app**.
3. "Execute as": **Me** (tu). "Who has access": **Anyone**.
4. Deploy. Copia la URL que et dona (acaba en `/exec`).

### 4. Configura el Sheet ID i el secret

Encara a l'editor d'Apps Script, obre `Code.gs`, selecciona la funció
`setup_` al desplegable de funcions de dalt, i executa-la manualment un
cop des de l'editor **amb els paràmetres omplerts** (edita temporalment la
crida o fes servir l'editor d'execució amb arguments):

```js
setup_('EL_ID_DEL_TEU_GOOGLE_SHEET', 'un-secret-llarg-i-aleatori-que-inventis-tu');
```

L'ID del Sheet és la part de la URL entre `/d/` i `/edit`:
`https://docs.google.com/spreadsheets/d/AQUEST_ID_AQUI/edit`.
Pots fer servir un Sheet ja existent o crear-ne un de nou en blanc — les
pestanyes "Albarans" i "Linies" es creen soles la primera vegada.

### 5. Crea `webapp.json` local

A l'arrel del projecte (aquest fitxer **no** es puja a git):

```json
{
  "url": "https://script.google.com/macros/s/AKfycb.../exec",
  "secret": "el-mateix-secret-que-has-posat-a-setup_"
}
```

## Ús

Dins d'una sessió de Claude Code oberta en aquest directori:

> Passa'm l'albarà `~/Downloads/26-26659 - DISSABTE NIT BLANCA OLIVERES.pdf` al Sheets

Claude farà servir la skill `albara-to-sheet`: llegirà el PDF, n'extraurà
capçalera + línies + totals, i enviarà les dades al Web App perquè les
escrigui.

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
- El "secret" del pas 4/5 evita que algú que trobi la URL del Web App
  pugui escriure dades al teu Sheet sense permís; no cal que sigui res
  memorable, només llarg i aleatori.
