# Klassen-Tetris

Minimalistisches Tetris für bis zu 8 Spieler im Klassenraum. Es muss nichts installiert werden: Alle brauchen nur einen Browser und Internet.

## So startest du eine Runde (Lehrkraft)

1. Öffne die Spielseite am Beamer-PC und klicke auf **Raum erstellen**.
2. Am Beamer erscheinen die Adresse, ein 4-stelliger Code und ein QR-Code.
3. Die Schüler öffnen dieselbe Adresse, geben den Code und ihren Namen ein und klicken auf **Beitreten**.
4. Wähle die Rundenzeit und klicke auf **Spiel starten**. Nach einem Countdown von 3 Sekunden geht es los.
5. Am Ende erscheint die Rangliste. Mit **Neue Runde** kommen alle zurück in den Warteraum.

Das Fenster der Lehrkraft muss offen bleiben, solange gespielt wird, denn es leitet das Spiel.

## Steuerung (Schüler)

| Taste | Aktion |
|---|---|
| ← → (oder A/D) | bewegen |
| ↑ (oder W/X) | drehen |
| Y/Z | andersherum drehen |
| ↓ (oder S) | schneller fallen |
| Leertaste | sofort fallen lassen |

## Regeln im Modus „Klassisch“

- Jeder spielt für sich, alle bekommen dieselbe Reihenfolge der Steine.
- Punkte: 100, 300, 500 oder 800 für 1, 2, 3 oder 4 Reihen auf einmal, jeweils mal das Level. Dazu kommen Bonuspunkte fürs schnelle Fallenlassen.
- Alle 10 Reihen steigt das Level, und die Steine fallen schneller.
- Wer oben anstößt, bekommt ein leeres Feld und spielt weiter. Die Punkte bleiben erhalten.
- Wer nach Ablauf der Zeit die meisten Punkte hat, gewinnt.

## Wenn etwas nicht klappt

- **„Raum wurde nicht gefunden“**: Code prüfen. Das Fenster der Lehrkraft muss noch offen sein.
- **Ein Schüler hat die Seite neu geladen**: Einfach mit demselben Namen wieder beitreten. Er spielt ab der nächsten Runde wieder mit.
- **Niemand kann sich verbinden**: Das Schulnetz blockiert eventuell direkte Verbindungen zwischen den PCs (WebRTC). Dann bitte melden, dafür gibt es eine Ausweichlösung.

## Technik

Reine Webseite (HTML/JS). Der Browser der Lehrkraft ist der Spielleiter, die Schüler verbinden sich per WebRTC direkt mit ihm. Der kostenlose PeerJS-Dienst vermittelt nur den Verbindungsaufbau. Die Bibliotheken liegen im Ordner `vendor/`.
