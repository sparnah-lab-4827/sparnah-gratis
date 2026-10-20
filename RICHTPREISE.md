# Richtpreise pflegen

Die 36 Einträge in `site/estimates.js` wurden am 20.10.2026 anhand öffentlicher
ALDI-SÜD-Onlinepreisbeispiele recherchiert. Sie sind Budgethilfen, keine
statistisch erhobenen Durchschnittspreise und keine bestätigten Preise eines
ausgewählten Marktes. Jede Zeile enthält Packungsmenge, Basispreis und Quelle.
Die ALDI-Quellen begründen auch keinen Preis bei anderen Ketten.

Nächste manuelle Überprüfung vorgesehen: 20.04.2027. Der Nutzer stößt die
Aktualisierung an; es ist kein wiederkehrender Auftrag eingerichtet.

## Aktualisierung

1. Jede verlinkte Quelle erneut prüfen. Produkt, Sorte, Marke, Menge und Einheit
   müssen zusammenpassen. Keine Aktionspreise oder Kundenkartenpreise als
   normale Richtpreisgrundlage aufnehmen.
2. Nicht mehr belegbare Einträge entfernen oder ihr ursprüngliches Prüfdatum
   beibehalten; kein neues Prüfdatum ohne Recherche vergeben. Bei Teilupdates
   müssen die Metadaten der einzelnen Einträge entsprechend getrennt werden.
3. Neue Produkte mit eng gefassten Aliasnamen ergänzen. Besondere Ernährungsformen
   und konkrete Marken nicht gleichsetzen. Keine Preis-Schätzung für bloße
   Wortfragmente wie „Milch“ innerhalb von Milchreis.
4. `reviewedAt` und `reviewDue` nur nach Prüfung des gesamten Bestands ändern.
   Überfällige Werte bleiben als veraltet sichtbar. Schätzwerte werden auf
   fünf Cent gerundet. Bei abweichender eindeutiger Größe wird proportional
   gerechnet (nur halbe bis doppelte Referenzmenge); das ist ausdrücklich eine
   Schätzung. Unbekannte Packungen erhalten eine sichtbare Mengenannahme.
5. JavaScript-Tests und Python-Pipelinetests ausführen. Shell-Version anheben,
   Website veröffentlichen und neue APK mit demselben Signaturschlüssel sowie
   höherem versionCode erstellen. APK mit Datum und Uhrzeit (Europe/Berlin)
   ausliefern.

## Trennung von bestätigten Preisen

`estimates.js` wird nur zur Darstellung von Produkten ohne eingeplanten
Händlerpreis verwendet. Es liefert keine Offers, Händlerzuordnung,
Rabattbasis oder Verfügbarkeitsbestätigung. Schätzwerte fließen ausschließlich
in das separat beschriftete Budget ohne Pfand ein. Sind weitere Produkte nicht
schätzbar, heißt es Teilsumme. Einkaufsliste, Sparplan und geteilte Plantexte
kennzeichnen geschätzte Beträge; die Richtpreisliste ist in den Einstellungen
einsehbar.
