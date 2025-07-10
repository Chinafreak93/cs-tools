// Variablen und Controller
let imageDownloads = [];
let downloadController; // Globaler Controller
let zipGenerationAborted = false; // Neue Variable, um die ZIP-Generierung zu überwachen

let productDataCSV = ''; // Globale CSV-Daten
let csvLoadedPromise;    // Verspricht, dass die CSV geladen ist

document.addEventListener('DOMContentLoaded', () => {
    // Spinner beim Start anzeigen
    document.getElementById('csvLoadingOverlay').style.display = 'flex';

    csvLoadedPromise = fetch('https://chinafreak93.github.io/cs-tools/shop-data.csv')
        .then(response => response.text())
        .then(data => {
            productDataCSV = data;
        })
        .catch(error => {
            console.error('Fehler beim Laden der CSV-Daten:', error);
        })
        .finally(() => {
            // Spinner nach Abschluss (auch bei Fehlern) ausblenden
            document.getElementById('csvLoadingOverlay').style.display = 'none';
        });

    const articleNumbersInput = document.getElementById('articleNumbers');
    articleNumbersInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            searchProducts();
        }
    });

    updateSearchHistoryUI();
});

function updateLoadingBar(percentage) {
    const roundedPercentage = Math.floor(percentage);
    document.getElementById('loadingBar').style.width = roundedPercentage + '%';
    document.getElementById('loadingBarPercentage').innerText = roundedPercentage + '%';
}

function updateDownloadLoadingBar(percentage) {
    const roundedPercentage = Math.floor(percentage);
    document.getElementById('downloadLoadingBar').style.width = roundedPercentage + '%';
    document.getElementById('downloadLoadingBarPercentage').innerText = roundedPercentage + '%';
}

async function searchProducts() {
    await csvLoadedPromise; // Warten, bis die CSV fertig geladen ist

    if (!productDataCSV) {
        console.error('CSV-Daten konnten nicht geladen werden.');
        return;
    }
    const articleNumbersInput = document.getElementById('articleNumbers').value.trim();
    const articleNumbersArray = articleNumbersInput.split(/[,\s]+/).map(num => num.trim()).filter(num => num);

    if (articleNumbersArray.length > 0) {
        // Holt den bestehenden Verlauf oder erstellt ein leeres Array
        let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

        // Neuen Eintrag mit Timestamp hinzufügen
        const timestamp = new Date().toLocaleString(); // Aktuelles Datum & Uhrzeit
        const newEntry = { query: articleNumbersArray.join(", "), time: timestamp }; // Speicherung als String

        // Falls dieselbe Anfrage schon existiert -> nicht doppelt speichern
        if (!searchHistory.some(entry => entry.query === newEntry.query)) {
            searchHistory.unshift(newEntry); // Neueste zuerst
            if (searchHistory.length > 10) {
                searchHistory.pop(); // Maximal 10 Einträge speichern
            }
            localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        }

        updateSearchHistoryUI(); // UI aktualisieren
    }

    document.getElementById('loadingBarContainer').style.display = 'block';
    updateLoadingBar(0);
    document.getElementById('notFoundResults').innerHTML = '';

    // Daten aus dem localStorage abrufen
    const productData = productDataCSV;
    if (!productData) {
        console.error('Produktdaten konnten nicht geladen werden.');
        document.getElementById('loadingBarContainer').style.display = 'none';
        return;
    }

    Papa.parse(productData, {
        header: true,
        worker: true,
        complete: function (results) {
            const products = results.data;
            const productMap = new Map(products.map(item => [item['sku'], item]));

            const foundProducts = [];
            const notFoundProducts = [];

            articleNumbersArray.forEach(articleNumber => {
                const product = productMap.get(articleNumber);
                if (product) {
                    const imageUrl = product['image_link'];
                    const imageUrlWithoutSuffix = imageUrl.substring(0, imageUrl.lastIndexOf('/'));
                    imageDownloads.push({ ...product, imageUrl: imageUrlWithoutSuffix });
                    foundProducts.push({ ...product, imageUrl: imageUrlWithoutSuffix });
                } else {
                    notFoundProducts.push(articleNumber);
                }
            });

            displayResults(foundProducts);
            toggleButtons(foundProducts.length > 0);
            displayNotFoundResults(notFoundProducts);

            document.getElementById('loadingBarContainer').style.display = 'none';
        }
    });
}

// 🎯 Funktion zum Aktualisieren des Suchverlaufs in der UI
function updateSearchHistoryUI() {
    const searchHistoryList = document.getElementById('searchHistoryList');
    const clearHistoryButton = document.getElementById('clearHistoryButton');
    searchHistoryList.innerHTML = '';

    let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

    if (searchHistory.length === 0) {
        clearHistoryButton.style.display = 'none';
        return;
    }

    clearHistoryButton.style.display = 'block';

    searchHistory.forEach((entry) => {
        const li = document.createElement('li');
        li.classList.add('search-history-item');

        li.innerHTML = `
            <div class="history-item">
                <span class="history-time">${entry.time}</span>
				<span class="history-query">${entry.query}</span>
            </div>
        `;

        // Beim Klick auf den Eintrag wird die Suche erneut ausgeführt
        li.addEventListener('click', () => {
            document.getElementById('articleNumbers').value = entry.query;
            searchProducts();
        });

        searchHistoryList.appendChild(li);
    });
}

// 🎯 Funktion zum Umschalten des Accordions
document.getElementById('toggleHistoryButton').addEventListener('click', () => {
    const searchHistoryContainer = document.getElementById('searchHistoryContainer');
    searchHistoryContainer.classList.toggle('collapsed');

    // Button-Text ändern
    const button = document.getElementById('toggleHistoryButton');
    if (searchHistoryContainer.classList.contains('collapsed')) {
        button.textContent = '🔍 Suchverlauf anzeigen';
    } else {
        button.textContent = '🔽 Suchverlauf ausblenden';
    }
});

// 🎯 Verlauf löschen
document.getElementById('clearHistoryButton').addEventListener('click', () => {
    localStorage.removeItem('searchHistory');
    updateSearchHistoryUI();
});

// 🎯 Beim Laden der Seite den Verlauf anzeigen
document.addEventListener('DOMContentLoaded', () => {
    updateSearchHistoryUI();
});


function displayResults(products) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    // Vorherige "Alle auswählen"-Checkbox entfernen, falls vorhanden
    let existingSelectAllContainer = document.getElementById('selectAllContainer');
    if (existingSelectAllContainer) {
        existingSelectAllContainer.remove();
    }

    if (products.length === 0) {
        resultsContainer.textContent = 'Keine Produkte gefunden.';
        return;
    }

    // "Alle auswählen"-Checkbox erstellen
    const selectAllContainer = document.createElement('div');
    selectAllContainer.id = 'selectAllContainer';
    selectAllContainer.classList.add('select-all-container');
    selectAllContainer.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="selectAllCheckbox"> Alle auswählen
        </label>
    `;

    // Die Checkbox VOR dem resultsContainer platzieren
    resultsContainer.parentNode.insertBefore(selectAllContainer, resultsContainer);

    products.forEach(product => {
        const productDiv = document.createElement('div');
        productDiv.classList.add('product-item');
        productDiv.innerHTML = `
            <div class="prod-infos">
                <p><span>Artikelnummer:</span> ${product.sku}</p>
                <p><span>Name:</span> ${product.title || 'Nicht verfügbar'}</p>
            </div>
            <div class="prod-img-container">
                <img src="${product.imageUrl}" alt="Produktbild">
                <i class="fa-solid fa-download download-icon" data-url="${product.imageUrl}" data-name="${product.sku}.png"></i>
            </div>
            <input type="checkbox" class="select-product" data-sku="${product.sku}">
        `;
        resultsContainer.appendChild(productDiv);

        const checkbox = productDiv.querySelector('.select-product');

        // Klick auf das Bild oder den Container toggelt Checkbox und Rahmen
        productDiv.addEventListener('click', function (event) {
            if (event.target.type !== 'checkbox' && !event.target.classList.contains('download-icon')) {
                checkbox.checked = !checkbox.checked;
            }
            toggleSelectionFrame(productDiv, checkbox.checked);
        });

        // Direktes Anklicken der Checkbox aktualisiert auch den Rahmen
        checkbox.addEventListener('change', function () {
            toggleSelectionFrame(productDiv, checkbox.checked);
        });
    });

    // "Alle auswählen"-Funktion aktivieren
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    selectAllCheckbox.addEventListener('change', function () {
        const checkboxes = document.querySelectorAll('.select-product');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            toggleSelectionFrame(checkbox.closest('.product-item'), checkbox.checked);
        });
    });

    // Event-Listener für einzelne Bild-Downloads
    document.querySelectorAll('.download-icon').forEach(icon => {
        icon.addEventListener('click', function (event) {
            event.stopPropagation(); // Verhindert, dass der Checkbox-Status geändert wird
            const imgUrl = event.target.getAttribute('data-url');
            const imgName = event.target.getAttribute('data-name');
            downloadSingleImage(imgUrl, imgName);
        });
    });
}

// Hilfsfunktion: Einzelnes Bild herunterladen
function downloadSingleImage(imageUrl, imageName) {
    fetch(imageUrl)
        .then(response => response.blob())
        .then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = imageName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(error => console.error('Fehler beim Herunterladen:', error));
}

// Hilfsfunktion: Fügt einen blauen Rahmen hinzu oder entfernt ihn
function toggleSelectionFrame(element, isSelected) {
    if (isSelected) {
        element.style.border = '2px solid blue';
    } else {
        element.style.border = '2px solid white';
    }
}

function displayNotFoundResults(notFoundProducts) {
    const notFoundResultsContainer = document.getElementById('notFoundResults');
    if (notFoundProducts.length > 0) {
        notFoundResultsContainer.innerHTML = `
        <h4>Die folgenden Artikelnummern wurden nicht gefunden (${notFoundProducts.length}):</h4>    
        <p>${notFoundProducts.join(' || ')}</p>
        <a href="https://www.mediamarkt.ch/de/promo-list/${notFoundProducts.join('||')}" target="_blank">Produkte im Online-Shop anschauen</a>
        `;
    } else {
        notFoundResultsContainer.innerHTML = '';
    }
}

function updateProgress(completedImages, totalImages, zipProgress = 0) {
    const imageProgress = Math.floor((completedImages / totalImages) * 100);
    const totalProgress = Math.floor((imageProgress * 0.1) + (zipProgress * 0.9));
    updateDownloadLoadingBar(totalProgress);
}

async function convertImageToPNGBlob(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('PNG-Konvertierung fehlgeschlagen'));
            }, 'image/png');
        };
        img.onerror = reject;
        img.src = imageUrl;
    });
}

function downloadImages(format = 'normal', zipName = 'images.zip') {
    const zip = new JSZip();
    const promises = [];

    // Nur ausgewählte Bilder ermitteln
    const selectedCheckboxes = document.querySelectorAll('.select-product:checked');
    if (selectedCheckboxes.length === 0) {
        alert("Bitte mindestens ein Bild auswählen!");
        return;
    }

    const selectedSkus = Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.sku);
    const selectedImages = imageDownloads.filter(image => selectedSkus.includes(image.sku));

    const totalImages = selectedImages.length;
    let completedImages = 0;
    let downloadAborted = false;

    downloadController = new AbortController();
    const { signal } = downloadController;
    zipGenerationAborted = false;

    selectedImages.forEach((image) => {
        let imgUrl = image.imageUrl;
        let imgName = '';

        // Berechne den Bildnamen basierend auf dem Format
        if (format === 'normal') {
            imgName = `${image.sku}_${image.title}.png`;
        } else if (format === 'skuOnly') {
            imgName = `${image.sku}.png`;
        } else if (format === 'special') {
            imgUrl = `${imgUrl}?x=1800&y=1800&format=png&s&trim&ex=1800&ey=1800&align=center&resizesource&cox=0&coy=0&cdx=1800&cdy=1800`;
            imgName = `${image.sku}_special.png`;
        }

        const extensionIndex = imgName.lastIndexOf('.');
        const extension = imgName.substring(extensionIndex);
        let filenameWithoutExtension = imgName.substring(0, extensionIndex).replace(/[\/\\:*?"<>|(),\-+.]/g, '').replace(/\s+/g, '_');

        if (filenameWithoutExtension.length > 55 - extension.length) {
            filenameWithoutExtension = filenameWithoutExtension.substring(0, 55 - extension.length);
        }

        imgName = filenameWithoutExtension + extension;

        promises.push(
            fetch(imgUrl, { signal })
                .then(response => {
                    if (!response.ok) throw new Error('Download fehlgeschlagen');
                    return response.blob();
                })
		.then(() => convertImageToPNGBlob(imgUrl))
		.then(pngBlob => {
		    if (!downloadAborted && !zipGenerationAborted) {
		        zip.file(imgName, pngBlob, { binary: true });
		        completedImages++;
		        const progress = (completedImages / totalImages) * 100;
		        updateDownloadLoadingBar(progress);
		    }
		})
                .catch(error => {
                    if (error.name === 'AbortError') downloadAborted = true;
                })
        );
    });

    document.getElementById('downloadLoadingBarContainer').style.display = 'block';

    Promise.all(promises)
        .then(() => {
            if (!downloadAborted && !zipGenerationAborted) {
                return zip.generateAsync({ type: "blob" }, (metadata) => {
                    updateDownloadLoadingBar(metadata.percent);
                });
            } else {
                throw new Error('Download wurde abgebrochen.');
            }
        })
        .then(content => {
            if (!downloadAborted && !zipGenerationAborted) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.setAttribute('download', zipName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            document.getElementById('downloadLoadingBarContainer').style.display = 'none';
        })
        .catch(error => {
            console.error('Fehler bei der ZIP-Erstellung:', error);
            document.getElementById('downloadLoadingBarContainer').style.display = 'none';
        });
}

function downloadAllImages() {
    downloadImages('normal', 'images.zip');
}

function downloadImagesWithArticleNumbers() {
    downloadImages('skuOnly', 'images_with_article_numbers.zip');
}

function downloadSpecialFormatImages() {
    downloadImages('special', 'special_format_images.zip');
}

function cancelDownload() {
    if (downloadController) {
        downloadController.abort();
        zipGenerationAborted = true;
        document.getElementById('downloadLoadingBarContainer').style.display = 'none';
    }
}


function toggleButtons(show) {
    const buttons = document.querySelectorAll('#resetButton, .download');
    buttons.forEach(button => {
        button.style.display = show ? 'inline-block' : 'none';
    });
}

function resetTool() {
    document.getElementById('articleNumbers').value = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('notFoundResults').innerHTML = '';
    imageDownloads = [];

    // "Alle auswählen"-Checkbox entfernen, falls sie existiert
    let selectAllContainer = document.getElementById('selectAllContainer');
    if (selectAllContainer) {
        selectAllContainer.remove();
    }

    toggleButtons(false);
}
