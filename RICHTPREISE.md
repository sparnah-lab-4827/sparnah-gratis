# Richtpreise pflegen

Die Richtpreisliste umfasst die bisherigen 36 eng zugeordneten Beispiele in
`site/estimates.js` und eine größere Momentaufnahme in
`site/estimate-references.js`: 2.070 am 20.10.2026 beobachtete öffentliche
ALDI-SÜD-Normalpreise sowie 99 ergänzend recherchierte Referenzen für bisher
fehlende Produktgruppen, unter anderem Instantgerichte, Obst, Gemüse und
Haushaltspapier, Reiniger und weitere Haushaltsprodukte. Jede Referenz enthält
Preis, Packung, Quelle und Prüfdatum. Die fünf Frosch-Herstellerprodukte und
zwölf allgemeinen Haushaltswünsche erhalten daraus gekennzeichnete Budgets.
Spray, Nachfüllung und Konzentrat, Papierart und Lagenzahl sowie Beutelvolumen
und Backpapierformat bleiben bei der Zuordnung getrennt. Papierpreise werden
je 100 Blatt angezeigt; Körpergewichte bei Windeln gelten nicht als Packungsgewicht.
Die sichtbaren und strukturierten ALDI-Preise wurden beim Import gegengeprüft;
Aktionspreise werden nicht zu angeblichen Normalpreisen umgedeutet.
Bei fünf Salatkrönung-Einträgen beschreibt die Händler-Mengenangabe die
Zubereitung. Sie sind daher als eine gesamte 5er-Packung mit unbekanntem
Nettogewicht erfasst; die zubereiteten Milliliter dienen nicht als Packungsgröße.

Diese Werte sind Budgethilfen, keine statistisch erhobenen
Marktdurchschnittspreise und keine bestätigten Preise eines ausgewählten
Marktes. Auch Preise anderer Onlinehändler belegen keinen örtlichen Ladenpreis.
Ab-Preise, Online-Multipacks und weitere Einschränkungen stehen in den Notizen
der jeweiligen Referenz.

Nächste manuelle Überprüfung vorgesehen: 20.04.2027. Der Nutzer stößt die
Aktualisierung an; es ist kein wiederkehrender Auftrag eingerichtet.

## Aktualisierung

1. Jede verlinkte Quelle erneut prüfen. Produkt, Sorte, Marke, Menge und Einheit
   müssen zusammenpassen. Keine Aktionspreise oder Kundenkartenpreise als
   normale Richtpreisgrundlage aufnehmen.
2. Nicht mehr belegbare Einträge entfernen oder ihr ursprüngliches Prüfdatum
   beibehalten; kein neues Prüfdatum ohne Recherche vergeben. Bei Teilupdates
   müssen die Metadaten der einzelnen Einträge entsprechend getrennt werden.
3. Nach jeder Ergänzung den gesamten deduplizierten Katalog einschließlich
   Sortiment prüfen. Die Budgetzuordnung nutzt zuerst das konkrete Produkt,
   danach eng passende Produktfamilien. Beutel, Cups, trockene Nudeln und
   fertige Gerichte sind verschiedene Preisgrundlagen. Besondere Ernährungsformen
   und konkrete Marken dürfen nicht als identische Produkte ausgegeben werden.
   „Weitere Angebote“ und andere gemischte Abteilungen sind keine brauchbare
   Grundlage für einen pauschalen Durchschnittspreis.
4. `reviewedAt` und `reviewDue` nur nach Prüfung des gesamten Bestands ändern.
   Überfällige Werte bleiben als veraltet sichtbar. Schätzwerte werden auf
   fünf Cent gerundet. Abweichende Größen werden nur innerhalb der passenden
   Produktfamilie und Einheit umgerechnet; das ist ausdrücklich eine Schätzung.
   Unbekannte Packungen erhalten eine sichtbare Mengenannahme. Bei
   Größenbereichen wird die verwendete Annahme benannt; ein scheinbar exakter
   Kilopreis wird dann nicht dargestellt.
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
kennzeichnen geschätzte Beträge, angenommene Packungen und abgeleitete
Vergleichsgrundlagen. Die Richtpreisliste ist in den Einstellungen durchsuchbar.
Pro Suchergebnis werden höchstens 60 Referenzen dargestellt, damit die
Einstellungen auch auf dem Handy zügig reagieren. Schätzungen sind pro
Produkt, Größe und Datum zwischengespeichert.
