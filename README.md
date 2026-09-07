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
clasp create --type standalone --title "Albarans CODIBA" --rootDir src
```

`clasp create` sobreescriu `src/appsscript.json` amb un manifest per
defecte — torna a deixar-hi el fus horari i el bloc `webapp` (mira'l al
repo si cal) i després puja:

```bash
clasp push --force
```

### 3. Desplega'l com a Web App

```bash
clasp deploy --description "Web app v1"
```

Això et dona un `deploymentId`; la URL del Web App és:
`https://script.google.com/macros/s/<deploymentId>/exec`.

### 4. Autoritza el script (un pas manual imprescindible, un sol cop)

La primera vegada, Google necessita que **tu mateix** autoritzis el script
des de l'editor abans que el Web App funcioni (encara que el desplegament
ja estigui marcat com a públic) — si no ho fas, l'URL respon amb una
pàgina d'"Necessites accés".

1. Obre l'editor: `clasp open` (o la URL que et va donar `clasp create`).
2. Al desplegable de funcions de dalt de tot de l'editor, selecciona
   `doPost` (o qualsevol funció) i clica ▶ **Run**. Fallarà (li falten els
   paràmetres de la petició HTTP), però això no importa — l'objectiu és
   només disparar la pantalla d'autorització.
3. Google et demanarà autoritzar-lo: tria el teu compte → si surt "Google
   no ha verificat aquesta app", clica **Avançat** → **Ves a Albarans
   CODIBA (no segur)** → **Permetre**. És normal per a scripts personals
   no publicats; és el teu propi script.

### 5. Crea `webapp.json` local

A l'arrel del projecte (aquest fitxer **no** es puja a git). L'ID del
Sheet és la part de la URL entre `/d/` i `/edit`
(`https://docs.google.com/spreadsheets/d/AQUEST_ID_AQUI/edit`); pots fer
servir un Sheet ja existent o crear-ne un de nou en blanc — les pestanyes
"Albarans" i "Linies" es creen soles la primera vegada:

```json
{
  "url": "https://script.google.com/macros/s/AKfycb.../exec",
  "sheet_id": "EL_ID_DEL_TEU_GOOGLE_SHEET"
}
```

El Web App desa aquest `sheet_id` la primera vegada que rep una petició
amb aquest camp, així que a partir de llavors ja no caldria ni enviar-lo.

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
- L'endpoint no porta cap secret: qualsevol que tingui la URL exacta del
  Web App podria escriure-hi dades. La URL és llarga i aleatòria (difícil
  d'endevinar), però no la comparteixis públicament. Si algun dia vols
  afegir-hi una capa extra de protecció, es pot tornar a introduir un
  token comprovat a `doPost`.
