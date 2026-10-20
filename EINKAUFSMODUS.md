# Einkauf im Markt

„Einkauf starten“ übernimmt einen Ladenbesuch aus dem Sparplan einschließlich
der dort zugeordneten Produkte ohne bestätigten Preis. Die gewählte Alternative
bleibt sichtbar. Abhaken verwendet weiterhin die ursprüngliche Einkaufsposition;
bereits abgehakte Produkte bleiben im gestarteten Rundgang sichtbar.

Während des Einkaufs stehen alle Produkte in einer vollständigen Liste
untereinander. Die farbigen Bereichsüberschriften gliedern die Liste, ohne dass
Bereiche geöffnet oder Produkte eingeblendet werden müssen. Im Rundgang wird
nur gescrollt und abgehakt; Fortschritt und Häkchen bleiben sichtbar.
Bearbeitungsfelder, Produktzuordnungen und ein zusätzlicher Marktplan stehen
nicht zwischen den Einkaufspositionen.

Der Marktplan ist die Sortiergrundlage der Einkaufsliste in diesem Rundgang.
Er wird vor dem Einkauf über den Sparplan oder die Einstellungen bearbeitet.
Die farbigen Bereiche stehen in Laufrichtung vom Eingang zur Kasse. Im
Marktplan-Editor können Reihenfolge, Namen, Symbole und Farben geändert sowie
eigene Bereiche hinzugefügt werden. Dort lassen sich auch Produkte ausdrücklich
einem Bereich zuordnen. Die Reihenfolge sortiert anschließend die gesamte
Einkaufsliste automatisch.
Entfernte Bereiche verlieren keine Produkte: Diese erscheinen unter „Sonstiges“.

Die eingebauten ALDI- und Kaufland-Reihenfolgen sind allgemeine Vorschläge,
keine vermessenen Filialpläne. Sie enthalten keine privaten Filialangaben.
Der Nutzer kann die Reihenfolge an seinen tatsächlichen Markt anpassen.

`site/shopping.js` normalisiert Einstellungen und gruppiert Produkte, ohne den
Sparplan oder die Originalprodukte zu verändern. Eigene Zuweisungen haben
Vorrang vor der automatischen Abteilungserkennung.

Unter dem unveränderten lokalen Schlüssel `sparnah-v1` werden
`base.settings.shoppingLayouts[retailerId]` sowie eine optionale
`shoppingSession` gespeichert. Die Speicherung bleibt beim APK-Update mit
derselben App-Kennung und Signatur erhalten. Deinstallation oder Löschen der
App-Daten entfernt lokale Daten.

Die Session hält die ausgewählten Produkte fest; Datum und Händlerpreis werden
bei jeder Anzeige erneut auf aktuelle Gültigkeit und vorhandene Quelle geprüft.
Bei fehlender Bestätigung wird nur ein ausdrücklich beschrifteter Richtwert
angezeigt, sofern es dafür eine brauchbare Grundlage gibt. Ein neuer Rundgang
aus dem Sparplan übernimmt neue Produkte und eine neue Preisplanung.
