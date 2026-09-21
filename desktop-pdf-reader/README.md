# Lavnor Czytnik PDF

Samodzielna aplikacja na Windows do odczytu plikow PDF - dziala w 100%
lokalnie na komputerze, bez laczenia sie z internetem i bez wysylania
dokumentow gdziekolwiek na zewnatrz. Silnik renderujacy to pdf.js
(Mozilla, licencja MIT), dolaczony lokalnie w `renderer/vendor/pdfjs/`.

## Instalacja na Windows (gotowy build)

1. Rozpakuj archiwum `LavnorPDFReader-Windows-x64.zip` w dowolnym
   miejscu na dysku (np. `C:\Programy\LavnorPDFReader`).
2. Uruchom `LavnorPDFReader.exe`. Nie jest wymagana instalacja ani
   uprawnienia administratora.
3. (opcjonalnie) Utworz skrot do pliku `.exe` i przypnij go do paska
   zadan lub pulpitu.
4. Windows przy pierwszym uruchomieniu moze pokazac ostrzezenie
   SmartScreen ("Windows chronil Twoj komputer"), poniewaz plik nie
   jest podpisany certyfikatem wydawcy. Kliknij "Wiecej informacji" ->
   "Uruchom mimo to". To normalne dla aplikacji nieopublikowanych w
   sklepie/bez platnego certyfikatu code-signing i nie oznacza
   zagrozenia - caly kod zrodlowy znajduje sie w tym repozytorium.

### Otwieranie plikow PDF

- Przycisk **"Otworz plik..."** lub przeciagniecie pliku PDF na okno
  aplikacji.
- Skrot **Ctrl+O** w aplikacji.
- Prawy klik na pliku PDF w Eksploratorze Windows -> **Otworz za
  pomoca** -> **Wiecej aplikacji** -> **Znajdz inna aplikacje na tym
  komputerze** -> wskaz `LavnorPDFReader.exe`. Zaznaczajac "Zawsze
  uzywaj tej aplikacji" Windows bedzie odtad otwieral wszystkie PDF-y
  w tym czytniku po dwukliku.

### Funkcje

Nawigacja stron, powiekszanie/pomniejszanie, dopasowanie do szerokosci,
obrot strony, druk (przez systemowe okno drukowania Windows), skroty
klawiszowe (strzalki / PageUp / PageDown / +/-).

## Budowanie samodzielnie ze zrodel

Wymaga Node.js (https://nodejs.org).

```
cd desktop-pdf-reader
npm install
npm start              # uruchomienie w trybie deweloperskim
npm run package:win     # zbudowanie folderu dist/LavnorPDFReader-win32-x64
```

Powstaly folder `dist/LavnorPDFReader-win32-x64` zawiera gotowy,
przenosny program - mozna go skopiowac na dowolny komputer z Windows
64-bit bez dodatkowej instalacji.

### Uwaga dot. podpisu cyfrowego i ikony

Ten build zostal wygenerowany na Linuksie bez Wine, dlatego plik `.exe`
nie ma osadzonej wlasnej ikony ani metadanych wersji (uzywa domyslnej
ikony Electron). Jesli zalezy Panu na wlasnej ikonie/podpisie, najlepiej
uruchomic `npm run package:win` bezposrednio na Windows (lub w
srodowisku z zainstalowanym Wine) - reszta kodu pozostaje bez zmian.
