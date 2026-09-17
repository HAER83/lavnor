# PDFcon

Prosta, lokalna aplikacja desktopowa (Windows / macOS / Linux) do konwertowania plików —
działa w pełni offline, bez wysyłania jakichkolwiek plików do internetu.

## Funkcje

- **Konwertuj na PDF** — z plików DOC, DOCX, JPG, PNG.
- **Konwertuj z PDF** — na DOCX, JPG lub PNG (każda strona PDF jako osobny obraz).
- **Scal PDF** — połącz wiele plików PDF w jeden, w wybranej kolejności.
- **Podziel PDF** — na pojedyncze strony albo według wybranego zakresu (np. `1-3,5,7-9`).

Skonwertowane pliki trafiają zawsze do podfolderu **`PDFcon`** wewnątrz systemowego
folderu **Pobrane / Downloads**.

## Czego potrzebujesz, aby uruchomić aplikację

**1. Node.js (wymagany do zbudowania i uruchomienia aplikacji)**

Pobierz i zainstaluj wersję LTS ze strony [nodejs.org](https://nodejs.org/) (instalator
"kliknij dalej, dalej, zakończ" — dostępny dla Windows, macOS i Linux). Node.js zawiera
`npm`, którego użyjemy do pobrania Electrona i pozostałych bibliotek.

**2. LibreOffice (wymagany tylko do konwersji DOC/DOCX ↔ PDF)**

Funkcje "obraz → PDF", "PDF → obraz", scalanie i dzielenie PDF działają bez żadnych
dodatkowych programów. Natomiast konwersja plików Word (DOC/DOCX) korzysta z
darmowego, otwartoźródłowego pakietu **LibreOffice** (uruchamianego w tle, w trybie
bez interfejsu), ponieważ jest to jedyny niezawodny sposób na wierne odwzorowanie
formatowania dokumentów Worda bez używania płatnych bibliotek lub usług
chmurowych. Pobierz go bezpłatnie z [libreoffice.org](https://www.libreoffice.org/download/download/)
i zainstaluj standardowo. Aplikacja PDFcon sama wykrywa, czy LibreOffice jest
zainstalowany (status widoczny w lewym dolnym rogu aplikacji) — jeśli go zabraknie,
pozostałe funkcje (obrazy, scalanie, dzielenie) nadal będą działać normalnie.

Nie musisz instalować niczego innego — żadnego Pythona, Adobe Acrobata ani kont online.

## Instalacja i pierwsze uruchomienie

W terminalu, w katalogu `pdfcon`:

```bash
npm install
npm start
```

`npm start` uruchamia aplikację bezpośrednio (tak jak zwykły program na laptopie) —
to najszybszy sposób na korzystanie z PDFcon i nie wymaga tworzenia instalatora.
Można powtarzać ten krok za każdym razem, gdy chcesz uruchomić aplikację, albo
utworzyć skrót do polecenia `npm start` w tym folderze.

## Zbudowanie gotowego pliku instalacyjnego (opcjonalnie)

Jeśli wolisz mieć klasyczny plik instalacyjny (`.exe` dla Windows, `.dmg` dla macOS,
`.AppImage` dla Linuksa) zamiast uruchamiania przez `npm start`, wykonaj build na
tym samym systemie operacyjnym, na którym chcesz używać aplikacji:

```bash
npm run build:win     # Windows -> plik instalatora w folderze release/
npm run build:mac     # macOS   -> plik .dmg w folderze release/
npm run build:linux   # Linux   -> plik .AppImage w folderze release/
```

Uwaga: budowanie instalatora dla Windows/macOS wymaga wykonania tej komendy
na komputerze z danym systemem operacyjnym (np. `build:mac` trzeba uruchomić na Macu).
Jeżeli po prostu chcesz korzystać z aplikacji na własnym laptopie, `npm start`
w zupełności wystarczy i jest najprostszą opcją.

## Struktura projektu

```
pdfcon/
├── assets/icon.svg          # źródłowa ikona aplikacji (generowana do ico/icns/png)
├── scripts/generate-icons.js
├── src/
│   ├── main/                # proces główny Electron (Node.js)
│   │   ├── main.js          # okno aplikacji + obsługa zdarzeń IPC
│   │   ├── preload.js       # bezpieczny most między UI a Node.js
│   │   ├── pdf-tools.js     # scalanie/dzielenie PDF, obrazy -> PDF (pdf-lib)
│   │   └── libreoffice.js   # wykrywanie i wywoływanie LibreOffice (DOC/DOCX)
│   └── renderer/            # interfejs użytkownika (HTML/CSS/JS)
└── package.json
```

## Bezpieczeństwo i prywatność

Wszystkie konwersje odbywają się lokalnie na Twoim komputerze. Aplikacja nie
łączy się z internetem i nie wysyła plików do żadnej usługi zewnętrznej.
