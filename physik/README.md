# Physik-Team

Kooperatives Physik-Spiel für die ganze Klasse (bis zu 18 Schüler mit iPad). Die Lehrkraft zeigt das Spiel auf dem Smartboard, die Schüler steuern ihren Avatar auf dem iPad. Es muss nichts installiert werden, alle brauchen nur einen Browser und Internet.

## So startest du ein Spiel (Lehrkraft)

1. Öffne die Spielseite am Smartboard-PC und klicke auf **Raum erstellen**.
2. Die Schüler scannen den QR-Code mit dem iPad (oder öffnen die Adresse und tippen den Code ein), geben ihren Namen ein und wählen einen Avatar.
3. Wähle ein Szenario und ein Level und klicke auf **Starten**. Die Aufgabe wird 6 Sekunden lang angezeigt, dann geht es los.
4. Oben kannst du **Physik-Hilfen** einschalten (Formeln, Drehmomente, Winkel, Lichtstärke). Sie erscheinen auch auf den iPads.
5. Nach dem Level: **Nächstes Level**, **Nochmal** oder zurück zur **Auswahl**.

Das Fenster der Lehrkraft muss offen bleiben, solange gespielt wird.

## Szenarien

| Szenario | Physik | Steuerung auf dem iPad | Level |
|---|---|---|---|
| **Wippe & Hebel** | Drehmoment M = m · g · r, Hebelgesetz | Schieberegler: Platz auf dem Balken | Gleichgewicht, Felsbrocken, Zwei Lasten, Kiste anheben, Ganz vorsichtig |
| **Laser & Spiegel** | Reflexionsgesetz, Lichtverlust pro Spiegel (90 % werden reflektiert) | Auf dem Bild ziehen = Spiegel verschieben, Regler = drehen | Um die Ecke, Doppelt hält besser, Rundherum, Zickzack |
| **Mischtemperatur** | Richmannsche Mischungsregel, Schmelzwärme von Eis (334 J/g) | Knopf gedrückt halten = eingießen | Lauwarm, Babybad 37 °C, Teewasser 70 °C, Eiskalte Limo |
| **Kurbel-Kraftwerk** | Energie E = P · t, Leistung in Watt, Energiespeicher | Schnell tippen = kurbeln (1 Tipp = 20 J) | Lichterkette, Ein Abend zu Hause, Wasserkocher-Alarm |

Jeder Avatar hat in der Wippe eine eigene Masse (25–60 kg) und ist entsprechend groß. Die Werte (Massen, Becher, Ziele) werden in jedem Level neu ausgelost und passen sich der Spielerzahl an, die Aufgaben sind immer lösbar.

Hinweise:
- Wippe: Am Drehpunkt sitzt ein Dämpfer mit etwas Haftreibung. Die Wippe bleibt stehen, wenn die Drehmomente links und rechts fast gleich sind. Steht die Wippe schon schräg und ist ausgeglichen, bleibt sie schräg (wie in echt): erst etwas aus dem Gleichgewicht bringen, dann wieder ausgleichen.
- Beim Hebel fällt die Kiste herunter, wenn sie zu schnell oder zu hoch angehoben wird.
- Laser: Spiegel auf der Ablage (unten) sind ausgeschaltet. Gibt es weniger Schüler als nötige Spiegel, bekommt jeder mehrere (Knopf „Nächster Spiegel“).
- Kraftwerk: Der Akku darf weder leer noch ganz voll werden. Sterne gibt es für die Zeit im grünen Bereich.

## Wenn etwas nicht klappt

- **„Raum wurde nicht gefunden“**: Code prüfen. Das Fenster der Lehrkraft muss noch offen sein.
- **Ein iPad hat die Seite neu geladen**: Mit demselben Namen wieder beitreten, der Avatar wird wieder übernommen.
- Wer mitten im Level beitritt, ist ab dem nächsten Level dabei.

## Technik

Reine Webseite (HTML/JS), wie Klassen-Tetris und Klassen-Rennen. Der Browser der Lehrkraft rechnet die Physik und schickt etwa 20-mal pro Sekunde den Zustand an alle iPads (WebRTC über PeerJS). Die iPads schicken nur ihre Eingaben. Für Tests: `?peerserver=host:port` nutzt einen eigenen PeerJS-Server, `?bot=1` lässt ein iPad zufällig mitspielen.
