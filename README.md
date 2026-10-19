# Sparnah

[App öffnen](https://sparnah-lab-4827.github.io/sparnah-gratis/)

Sparnah ist eine kostenlose Einkaufsliste mit Preisvergleich und Einkaufsplanung. Die Oberfläche läuft auf GitHub Pages. Persönliche Listen und Einstellungen bleiben im Browser.

## Private Marktdaten

Dieses öffentliche Projekt enthält eine neutrale Oberfläche und verschlüsselte Datenpakete. Filialen, regionale Quellen, Preisbelege, Prospekte und die dazugehörige Importkonfiguration werden hier nicht im Klartext veröffentlicht. Auch ohne Datenfreigabe lässt sich die öffentliche Oberfläche installieren.

Die private Datensammlung wird mit einer separat bereitgestellten Zugangsdatei auf dem eigenen Gerät aktiviert. Die App entschlüsselt sie lokal. Der Schlüssel wird nicht an GitHub oder Händler übertragen und nicht in einer Einkaufsliste-Sicherung gespeichert. Wer Zugriff auf die Zugangsdatei oder auf die gespeicherten Website-Daten hat, kann die freigeschalteten Marktdaten lesen. Die Datei deshalb privat aufbewahren.

## Benutzen

1. Die App öffnen und die eigene Zugangsdatei auswählen.
2. Unter **Läden** die gewünschten Märkte auswählen.
3. Produkte und Mengen auf die Liste setzen. Pro Position **Meine Auswahl** oder **Günstigstes passendes Produkt** wählen.
4. Im **Sparplan** Woche und maximal ein, zwei oder drei Geschäfte wählen.
5. Auf Android im Browser **App installieren** beziehungsweise **Zum Startbildschirm hinzufügen** wählen.

Auswahl und Listen werden nicht zwischen Geräten synchronisiert. Für ein zusätzliches Gerät wird die Zugangsdatei erneut benötigt. Sicherungen und die Zugangsdatei müssen getrennt aufbewahrt werden.

## Preise

Die Berechnung verwendet erfasste, zur Auswahl passende Angebote und tatsächlich geprüfte Normalpreise. Ein Tagespreis gilt nur am belegten Prüftag. Kundenkarten, App-Coupons und Bonusgutschriften zählen nicht mit. Bilder folgen dem tatsächlich eingeplanten Produkt, sofern dessen Identität belegt ist.

Bei einem geplanten Geschäft können Positionen ohne Preis dort zum Mitkaufen erscheinen. Sie erhalten keinen erfundenen Preis. Eine unvollständige Summe wird als solche bezeichnet. Quellenfehler und fehlende Abdeckung bleiben nach Freischaltung sichtbar. Erfasste Preise belegen keinen Filialbestand und keine vollständige Marktübersicht.

## Automatische Aktualisierung

GitHub Actions führt zweimal täglich sowie bei einer Veröffentlichung die Aktualisierung aus. Die Ausführung kann sich verzögern. Zwei getrennte Repository-Secrets schützen die Importlaufzeit und die Browserdaten. Die verschlüsselte Laufzeit wird nur im temporären Verzeichnis des Runners entschlüsselt. Private Prüfausgaben werden nicht veröffentlicht. Anschließend werden ausschließlich frisch verschlüsselte Pakete gespeichert und die neutrale Website bereitgestellt.

Der öffentliche Workflow verarbeitet keine Einkaufslisten. Die automatische Prüfung verlängert manuell belegte Momentaufnahmen nicht ohne neuen Beleg. Technische Fehler dürfen keine leeren oder erfundenen Angebote ersetzen.

## Entwicklung

Die öffentliche Oberfläche liegt unter `site/`, der generische Verschlüsselungs- und Aktualisierungsablauf unter `scripts/`. Tests für diesen öffentlichen Teil verwenden ausschließlich neutrale Prüfdaten. Die private Importlaufzeit einschließlich ihrer Belege und Tests liegt verschlüsselt unter `protected/`.

Produktbilder werden nach Freischaltung von externen Bildservern geladen; dabei fallen technische Verbindungsdaten an. Händlerseiten und Karten werden erst nach einem Klick geöffnet. Die App wird nicht von den Händlern betrieben.
