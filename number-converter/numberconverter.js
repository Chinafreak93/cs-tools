// JavaScript Document
function showPopup(message) {
    var popup = document.getElementById("popupMessage");
    popup.textContent = message;
    popup.style.display = "block";
    setTimeout(function() {
        popup.style.display = "none";
    }, 5000); // Popup disappears after 5000 ms
}

function convert() {
    var input = document.getElementById("numberInput").value;
    var format = document.getElementById("formatSelect").value;
    var output = document.getElementById("output");

    input = input.replace(/\|\|/g, " ").replace(/,/g, " ");
    
    var numbers = input.split(/\s+/).filter(function (item) {
        return item.trim() !== "";
    });

    if (format === "comma") {
        output.value = numbers.join(",");
    } else if (format === "commaAndEmptySpace") {
        output.value = numbers.join(", ");
    } else if (format === "pipe") {
        output.value = numbers.join("||");
    }

    // Update history after successful conversion
    updateHistory({ input: input, output: output.value });

    showPopup("Konvertierung erfolgreich!");
    document.getElementById("numberInput").focus(); // Set focus back to the input after conversion
}

function copyToClipboard(textarea) {
    textarea.select();
    document.execCommand("copy");
    showPopup("Output wurde in die Zwischenablage kopiert!");
}

function createSearchLink() {
    var input = document.getElementById("numberInput").value;
    var sortParam = document.getElementById("sortSelect").value;

    input = input.replace(/\|\|/g, " ").replace(/,/g, " ");
    
    var numbers = input.split(/\s+/).filter(function (item) {
        return item.trim() !== "";
    });

    var formattedNumbers = numbers.join("||");
    var searchLink = "https://www.mediamarkt.ch/de/promo-list/" + formattedNumbers;

    if (sortParam !== "") {
        searchLink += "?sort=" + sortParam;
    }

    // Speichert den Search Link zusammen mit dem Input in der Historie
    updateHistory({ input: input, output: searchLink, type: 'searchLink' });

    var linkElement = document.getElementById("searchLink");
    linkElement.href = searchLink;
    linkElement.textContent = "Suchlink öffnen";
    linkElement.style.display = "inline";

    var searchLinkOutput = document.getElementById("searchLinkOutput");
    searchLinkOutput.value = searchLink;
    searchLinkOutput.style.display = "block";

    showPopup("Search Link generiert!");
}

function updateHistory(newConversion) {
    let history = JSON.parse(localStorage.getItem('conversionHistory')) || [];
    // Wir speichern den Zeitstempel als ISO-String, der gut von JavaScripts Date-Objekt verarbeitet wird
    const timestamp = new Date().toISOString();
    newConversion.timestamp = timestamp;
    history.unshift(newConversion);
    history = history.slice(0, 10);
    localStorage.setItem('conversionHistory', JSON.stringify(history));
    displayHistory();
}

function displayHistory() {
    const history = JSON.parse(localStorage.getItem('conversionHistory')) || [];
    const historyTableBody = document.getElementById('conversionHistory');
    const historyContainer = document.getElementById('historyContainer');
    
    historyTableBody.innerHTML = '';

    if (history.length === 0) {
        historyContainer.style.display = 'none';
    } else {
        historyContainer.style.display = 'block';
        history.forEach((item, index) => {
            let date = new Date(item.timestamp);
            let dateString = `<span>${date.toLocaleDateString()}</span> <span>${date.toLocaleTimeString()}</span>`;
            let row = document.createElement('tr');
            row.innerHTML = `
                <td class="timestamp-cell" onclick="toggleContent(this.parentNode)">
                    ${dateString}
                    <i class="fas fa-chevron-right"></i>
                </td>
                <td class="content-cell">${item.input.slice(0, 50)}${item.input.length > 50 ? '...' : ''}</td>
                <td class="content-cell">${item.output.slice(0, 50)}${item.output.length > 50 ? '...' : ''}</td>
                <td><i class="fas fa-redo restore-icon" title="Wiederherstellen" onclick="restoreEntry(${index}, event)"></i></td>
            `;
            row.children[1].setAttribute('data-fulltext', item.input); // Speichert den vollständigen Text
            row.children[2].setAttribute('data-fulltext', item.output); // Speichert den vollständigen Text
            historyTableBody.appendChild(row);
        });
    }
}

function restoreEntry(index) {
    const history = JSON.parse(localStorage.getItem('conversionHistory')) || [];
    if (index >= 0 && index < history.length) {
        const entry = history[index];
        document.getElementById('numberInput').value = entry.input;
        if (entry.type === 'searchLink') {
            document.getElementById('searchLinkOutput').value = entry.output;
            document.getElementById('searchLinkOutput').style.display = 'block';
            var linkElement = document.getElementById("searchLink");
            linkElement.href = entry.output;
            linkElement.textContent = "Suchlink öffnen";
            linkElement.style.display = "inline";
        } else {
            document.getElementById('output').value = entry.output;
        }
    }
}

function clearHistory() {
    localStorage.removeItem('conversionHistory'); // Löscht die Historie aus dem localStorage
    displayHistory(); // Aktualisiert die Anzeige, die nun leer sein sollte
}
	
function toggleContent(row) {
    const icon = row.querySelector('.timestamp-cell i');
    Array.from(row.children).forEach(cell => {
        if (cell.classList.contains('content-cell')) {
            const isTruncated = cell.textContent.endsWith('...');
            const fullText = cell.getAttribute('data-fulltext');
            cell.textContent = isTruncated ? fullText : fullText.slice(0, 50) + (fullText.length > 50 ? '...' : '');
        }
    });
    // Wechselt das Icon abhängig vom Zustand des ersten Inhalts
    if (icon.classList.contains('fa-chevron-right')) {
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-up');
    } else {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-right');
    }
}

function resetConverter() {
    document.getElementById("numberInput").value = '';
    document.getElementById("output").value = '';
    document.getElementById("searchLinkOutput").value = '';
    document.getElementById("searchLinkOutput").style.display = 'none';
    document.getElementById("searchLink").style.display = 'none';
    document.getElementById("formatSelect").selectedIndex = 0;
}

document.addEventListener('DOMContentLoaded', displayHistory);
document.getElementById("numberInput").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        convert();
    }
});
document.getElementById("formatSelect").addEventListener("change", function() {
    document.getElementById("numberInput").focus();
});