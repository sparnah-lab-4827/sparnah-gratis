# Sparnah

[App öffnen](https://sparnah-lab-4827.github.io/sparnah-gratis/)

Sparnah ist eine kostenlose Einkaufsliste mit Preisvergleich und Einkaufsplanung. Die Oberfläche läuft auf GitHub Pages. Persönliche Listen und Einstellungen bleiben im Browser.

## Private Marktdaten

Dieses öffentliche Projekt enthält eine neutrale Oberfläche und verschlüsselte Datenpakete. Filialen, regionale Quellen, Preisbelege, Prospekte und die dazugehörige Importkonfiguration werden hier nicht im Klartext veröffentlicht. Auch ohne Datenfreigabe lässt sich die öffentliche Oberfläche installieren.

Die private Datensammlung wird mit einer separat bereitgestellten Zugangsdatei auf dem eigenen Gerät aktiviert. Die App entschlüsselt sie lokal. Der Schlüssel wird nicht an GitHub oder Händler übertragen und nicht in einer Einkaufsliste-Sicherung gespeichert. Wer Zugriff auf die Zugangsdatei oder auf die gespeicherten Website-Daten hat, kann die freigeschalteten Marktdaten lesen. Die Datei deshalb privat aufbewahren.

## Benutzen

1. Die App öffnen und die eigene Zugangsdatei auswählen.
2. Unter **Läden** die gewünschten Märkte einzeln oder mit **Märkte mit Preisen wählen** auswählen.
3. Produkte und Mengen auf die Liste setzen. Pro Position **Meine Auswahl** oder **Günstigstes passendes Produkt** wählen.
4. Im **Sparplan** Woche und maximal ein, zwei oder drei Geschäfte wählen.
5. Auf Android im Browser **App installieren** beziehungsweise **Zum Startbildschirm hinzufügen** wählen.

Eine leere Liste bietet **Mit passenden Preisen ausprobieren**. Dabei werden ausschließlich Beispielprodukte mit bestätigten Preisen für die gewählten Märkte, Woche und Ladenbegrenzung eingefügt. Allgemeine Wünsche wie Äpfel oder Nudeln erkennen passende frische beziehungsweise einfache Produkte mit derselben Packung; bestimmte Marken, Sorten und abweichende Größen bleiben getrennt.

Beim Wiederöffnen erscheint der zuletzt authentifizierte lokale Datenstand sofort. Neue Daten werden bei jedem Start sowie beim Wiederöffnen und Wiederverbinden im Hintergrund geprüft. Angebote, Prospekte und Quellenmeldungen richten sich nach den ausgewählten Märkten. Neue Märkte werden nicht automatisch aktiviert. Die gemeinsame verschlüsselte Datendatei enthält weiterhin den zentralen Datenstand; die persönliche Marktauswahl wird nicht an GitHub gesendet. Alte Preise und Prospekte behalten ihre ursprünglichen Gültigkeitsdaten.

Auswahl und Listen werden nicht zwischen Geräten synchronisiert. Für ein zusätzliches Gerät wird die Zugangsdatei erneut benötigt. Sicherungen und die Zugangsdatei müssen getrennt aufbewahrt werden.

## Preise

Die Berechnung verwendet erfasste, zur Auswahl passende Angebote und tatsächlich geprüfte Normalpreise. Ein Tagespreis gilt nur am belegten Prüftag. Kundenkarten, App-Coupons und Bonusgutschriften zählen nicht mit. Bilder folgen dem tatsächlich eingeplanten Produkt, sofern dessen Identität belegt ist.

Bei einem geplanten Geschäft können Positionen ohne Preis dort zum Mitkaufen erscheinen. Sie erhalten keinen erfundenen Preis. Eine unvollständige Summe wird als solche bezeichnet. Quellenfehler und fehlende Abdeckung bleiben nach Freischaltung sichtbar. Erfasste Preise belegen keinen Filialbestand und keine vollständige Marktübersicht.

## Automatische Aktualisierung

Die Läden werden jeweils einmal pro Händler angezeigt, ohne Adressen oder Kartenlinks. Die hinterlegte bevorzugte Filiale wird ausschließlich im verschlüsselten Datenbestand festgelegt. Andere Händler verwenden vorrangig die bisher gewählte Filiale. Eine bisher gewählte weitere Filiale derselben Kette wird auf diesen Eintrag umgestellt. Filialgebundene Preise werden dadurch nicht auf andere Filialen ausgeweitet.

GitHub Actions führt zweimal täglich sowie bei einer Veröffentlichung die Aktualisierung aus. Die Ausführung kann sich verzögern. Zwei getrennte Repository-Secrets schützen die Importlaufzeit und die Browserdaten. Die verschlüsselte Laufzeit wird nur im temporären Verzeichnis des Runners entschlüsselt. Private Prüfausgaben werden nicht veröffentlicht. Anschließend werden ausschließlich frisch verschlüsselte Pakete gespeichert und die neutrale Website bereitgestellt.

Der öffentliche Workflow verarbeitet keine Einkaufslisten. Die automatische Prüfung verlängert manuell belegte Momentaufnahmen nicht ohne neuen Beleg. Technische Fehler dürfen keine leeren oder erfundenen Angebote ersetzen.

## Entwicklung

Die öffentliche Oberfläche liegt unter `site/`, der generische Verschlüsselungs- und Aktualisierungsablauf unter `scripts/`. Tests für diesen öffentlichen Teil verwenden ausschließlich neutrale Prüfdaten. Die private Importlaufzeit einschließlich ihrer Belege und Tests liegt verschlüsselt unter `protected/`.

Produktbilder werden nach Freischaltung von externen Bildservern geladen; dabei fallen technische Verbindungsdaten an. Händlerseiten und Karten werden erst nach einem Klick geöffnet. Die App wird nicht von den Händlern betrieben.

## Android-APK

Unter `android/` liegt die eigenständig installierbare Android-App (Android 8 oder neuer mit aktuellem Android System WebView). Sie nutzt die Sparnah-Oberfläche im eigenen App-Fenster, mit eigenem lokalem Speicher und nativer Dateiauswahl für Zugriff und Sicherungen. Externe Händlerlinks öffnen den Browser. Die APK enthält die neutrale Oberfläche für Offline-Nutzung; aktuelle Oberfläche und Daten werden bei Verbindung geladen. Die erste Datenfreigabe benötigt Internet und die separate Zugriffsdatei. Browserlisten werden nicht automatisch in die App übernommen, sondern können über eine Sicherung importiert werden.

Der kostenlose GitHub-Actions-Lauf `Build installable Android app` kompiliert und prüft die APK-Signatur. Der dauerhafte Signaturschlüssel liegt nur in einem Repository-Secret und in einer privaten lokalen Sicherung. Die APK enthält weder private Daten noch Zugriffsschlüssel. Installationstests auf dem jeweiligen Handy bleiben erforderlich. Neue native App-Versionen müssen mit höherem `versionCode` und demselben Schlüssel signiert werden; Web-Oberflächenaktualisierungen werden online übernommen.

## Markenalternativen

„Günstigstes passendes Produkt“ und der entsprechende Button für die ganze Liste erlauben passende Markenalternativen einschließlich Eigenmarken. Neben Nuss-Nougat-Creme, Pasta, Reis, Butter und Milch werden eindeutig beschriebene Produkttypen verglichen: beispielsweise Mehl gleicher Getreideart und Type, Zucker gleicher Form, Haferflocken gleicher Art, einfache Tomatenprodukte, Naturjoghurt gleicher Fettstufe, einfache Quarkprodukte, Kaffee gleicher ausdrücklich benannter Zubereitung, Hülsenfrüchte, Tomatenketchup, Öle, Mineralwasser gleicher Kohlensäurestufe, Säfte und Pflanzendrinks gleicher Ausführung. Weitere konkrete Lebensmittel mit identischer Beschreibung können markenübergreifend verglichen werden. Unbekannte Zusätze und Mischsortimente bleiben ausgeschlossen. Die Regeln decken nicht jedes Katalogprodukt ab und versprechen keine identische Rezeptur.

Bei neuen Markenalternativen sind bis zu 20 % kleinere oder größere Packungen möglich. Verglichen wird der Kilo- oder Literpreis, für eine gemischte Liste auf die ursprüngliche Wunschmenge umgerechnet; der angezeigte Gesamtpreis bleibt der tatsächliche Kassenbetrag bei unveränderter Packungsanzahl. Gramm und Milliliter werden nicht gleichgesetzt. Der Plan zeigt Produkt, Größe, Grundpreis und jede Größenabweichung. „Meine Auswahl“ erhält die ursprüngliche Marke und Packung. Fehlende Preise werden nicht geschätzt.

Günstigere Alternativen zeigen ihren Grundpreis gegenüber dem ursprünglichen Produkt, wenn für beide am gewählten Einkaufstag im selben Laden ein nutzbarer Preis vorliegt. Händler-Rabatte werden separat aus ausgewiesenen Händler-Vergleichspreisen berechnet und nicht zur Einsparung durch einen Produktwechsel addiert. Normalpreise ohne höheren Vergleichspreis sind weiterhin gültige Preise und erhalten keine vermeintliche Rabattangabe. Offene Preise fehlen in der Zwischensumme.
