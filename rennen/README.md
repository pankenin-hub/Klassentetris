# Klassen-Rennen

Minimalistisches Kart-Rennen von oben gesehen, für bis zu 8 Fahrer im Klassenraum. Funktioniert genauso wie Klassen-Tetris: Es muss nichts installiert werden, alle brauchen nur einen Browser und Internet.

## So startest du ein Rennen (Lehrkraft)

1. Öffne die Spielseite am Beamer-PC und klicke auf **Raum erstellen**.
2. Am Beamer erscheinen die Adresse, ein 4-stelliger Code und ein QR-Code.
3. Die Schüler öffnen dieselbe Adresse, geben den Code und ihren Namen ein und klicken auf **Beitreten**.
4. Wähle Strecke und Rundenzahl und klicke auf **Rennen starten**. Nach einem Countdown von 3 Sekunden geht es los.
5. Sind alle im Ziel (oder 30 Sekunden nach dem Sieger), erscheint die Rangliste. Mit **Neues Rennen** kommen alle zurück in den Warteraum.

Das Fenster der Lehrkraft muss offen bleiben, solange gefahren wird.

## Steuerung (Schüler)

| Taste | Aktion |
|---|---|
| ↑ (oder W) | Gas |
| ↓ (oder S) | bremsen, rückwärts |
| ← → (oder A/D) | lenken |

## Regeln

- Alle fahren auf derselben Strecke. Jeder sieht alle Karts, das eigene ist gelb umrandet und heißt „Du“.
- Rasen bremst stark. Gelbe Pfeil-Felder geben kurz Turbo.
- Karts schubsen sich gegenseitig ein bisschen weg.
- Wer zuerst die eingestellte Rundenzahl schafft, gewinnt. Nach dem ersten Zieleinlauf haben die anderen noch 30 Sekunden.
- Strecken: Rundkurs (leicht), Kurvenreich, Haken.

## Wenn etwas nicht klappt

- **„Raum wurde nicht gefunden“**: Code prüfen. Das Fenster der Lehrkraft muss noch offen sein.
- **Ein Schüler hat die Seite neu geladen**: Einfach mit demselben Namen wieder beitreten. Er fährt ab dem nächsten Rennen wieder mit.

## Technik

Reine Webseite (HTML/JS), wie Klassen-Tetris. Jeder Schüler-Browser berechnet sein eigenes Kart und schickt die Position etwa 20-mal pro Sekunde an den Browser der Lehrkraft, der sie an alle verteilt (WebRTC über PeerJS). Für Tests: `?peerserver=host:port` nutzt einen eigenen PeerJS-Server, `?bot=1` lässt ein Kart automatisch fahren.
