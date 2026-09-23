# lexPDF

Samodzielna aplikacja na Windows do odczytu plikow PDF - dziala w 100%
lokalnie na komputerze, bez laczenia sie z internetem i bez wysylania
dokumentow gdziekolwiek na zewnatrz. Silnik renderujacy to pdf.js
(Mozilla, licencja MIT), dolaczony lokalnie w `renderer/vendor/pdfjs/`.

## Instalacja na Windows (gotowy build)

1. Rozpakuj archiwum `lexPDF-Windows-x64.zip` w dowolnym miejscu na
   dysku (np. `C:\Programy\lexPDF`).
2. Uruchom `lexPDF.exe`. Nie jest wymagana instalacja ani uprawnienia
   administratora.
3. (opcjonalnie) Utworz skrot do pliku `.exe` i przypnij go do paska
   zadan lub pulpitu.
4. Windows przy pierwszym uruchomieniu moze pokazac ostrzezenie
   SmartScreen ("Windows chronil Twoj komputer"), poniewaz plik nie
   jest podpisany certyfikatem wydawcy. Kliknij "Wiecej informacji" ->
   "Uruchom mimo to". To normalne dla aplikacji nieopublikowanych w
   sklepie/bez platnego certyfikatu code-signing i nie oznacza
   zagrozenia - caly kod zrodlowy znajduje sie w tym repozytorium.

### Otwieranie plikow PDF

- Przycisk **"Otworz..."** lub przeciagniecie pliku PDF na okno
  aplikacji.
- Skrot **Ctrl+O** w aplikacji.
- Prawy klik na pliku PDF w Eksploratorze Windows -> **Otworz za
  pomoca** -> **Wiecej aplikacji** -> **Znajdz inna aplikacje na tym
  komputerze** -> wskaz `lexPDF.exe`. Zaznaczajac "Zawsze uzywaj tej
  aplikacji" Windows bedzie odtad otwieral wszystkie PDF-y w tym
  czytniku po dwukliku.

## Funkcje

- Widok ciaglego przewijania (domyslny) oraz tryb pojedynczej strony.
- Dopasowanie widoku: szerokosc strony, cala strona, 100% (rzeczywisty
  rozmiar); plynny zoom kolkiem myszy z Ctrl.
- Panel boczny: miniaturki stron, spis tresci (zakladki), lista
  zalacznikow wbudowanych w PDF.
- Obrot widoku o 90° (tymczasowy, tylko na podglad).
- Zaznaczanie tekstu oraz zakreslacz / podkreslenie / przekreslenie -
  zapisywane automatycznie i przywracane przy ponownym otwarciu tego
  samego pliku. Uwaga: zaznaczenia sa przechowywane lokalnie przy
  aplikacji (nie sa zapisywane w samym pliku PDF), wiec sa widoczne
  tylko w lexPDF.
- Szukanie w dokumencie: **Ctrl+F** (podswietlanie dopasowan na
  stronie, licznik wynikow, wielkosc liter / cale wyrazy) oraz
  **Ctrl+Shift+F** (lista wynikow w panelu bocznym z fragmentem
  kontekstu wokol frazy).
- Obsluga plikow PDF zabezpieczonych haslem otwarcia.
- Pamiec sesji: aplikacja zapamietuje ostatnio otwarty plik, strone i
  poziom powiekszenia i przywraca je po ponownym uruchomieniu.
- Tryb ciemny dokumentu (odwrocenie kolorow strony) oraz automatyczne
  dopasowanie interfejsu do jasnego/ciemnego motywu Windows.
- Wydruk calego dokumentu (przez systemowe okno drukowania Windows).

### Celowo pominiete (zbyt duzy nakład jak na Electron/JS, poza zasiegiem tej aplikacji)

- Integracja z powloka Windows (miniaturki w Eksploratorze, panel
  podgladu, IFilter dla wyszukiwarki Windows) - wymaga natywnego
  komponentu COM/.NET, to osobny projekt.
- OCR skanow oraz przeszukiwanie wielu plikow/folderow na raz.
- Drukowanie w ukladzie broszury / kilka stron na kartce.
- Zapis zakreslen bezposrednio w bajtach pliku PDF (obecnie trzymane
  lokalnie przy aplikacji - patrz wyzej).

## Budowanie samodzielnie ze zrodel

Wymaga Node.js (https://nodejs.org).

```
cd desktop-pdf-reader
npm install
npm start                # uruchomienie w trybie deweloperskim
npm run package:win      # zbudowanie folderu dist/lexPDF-win32-x64
```

Powstaly folder `dist/lexPDF-win32-x64` zawiera gotowy, przenosny
program - mozna go skopiowac na dowolny komputer z Windows 64-bit bez
dodatkowej instalacji.

Budowanie dla Windows z poziomu Linuksa wymaga zainstalowanego Wine
(potrzebnego do osadzenia ikony `build/icon.ico` w pliku `.exe`):
`apt-get install wine64` (Ubuntu/Debian) lub uruchom `npm run
package:win` bezposrednio na Windows.
