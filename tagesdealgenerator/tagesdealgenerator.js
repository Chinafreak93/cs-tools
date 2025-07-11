// JavaScript Document
let csvData = [];
	let excelData = [];
	let displayedData = [];
	let imageElements = [];

	// Zeige den Lade-Overlay an
	document.getElementById('loading-overlay').style.display = 'flex';

	Papa.parse('https://chinafreak93.github.io/cs-tools/shop-data.csv', {
		download: true,
		header: true,
		complete: function(results) {
			csvData = results.data;
			console.log('CSV Daten geladen:', csvData);

			// Verstecke den Lade-Overlay
			document.getElementById('loading-overlay').style.display = 'none';
		}
	});

    document.getElementById('file').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                excelData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                const headers = excelData[0];
                excelData = excelData.slice(1).map(row => {
                    let obj = {};
                    row.forEach((cell, index) => {
                        obj[headers[index]] = cell;
                    });
                    return obj;
                });

                console.log('Excel Daten geladen:', excelData);

                mergeDataAndGenerateHTML();

                document.getElementById('download-button').style.display = 'inline-block';
                document.getElementById('screenshot-button').style.display = 'inline-block';
                document.getElementById('reset-button').style.display = 'inline-block';
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert('Bitte eine Excel-Datei hochladen.');
        }
    });

async function mergeDataAndGenerateHTML() {
    displayedData = [];
    let notFoundItems = [];

	for (const excelItem of excelData) {
    if (!excelItem || !excelItem.sku) {
        console.log('Ungültiges Excel-Element:', excelItem);
        continue; // Überspringe ungültige Elemente
    }

    const excelSku = excelItem.sku.toString().trim();
    const matchingCsvItems = csvData.filter(item => item.sku.toString().trim() === excelSku);
	if (matchingCsvItems.length > 0) {
		matchingCsvItems.forEach(csvItem => {
			const mergedItem = { ...csvItem, ...excelItem };
			displayedData.push(mergedItem);
		});
	} else {
		console.log('Produkt in CSV nicht gefunden:', excelSku);
		notFoundItems.push(excelSku);
	}
	}

    // Überprüfen, ob das not-found-div bereits existiert, und es ggf. entfernen
    const existingNotFoundDiv = document.getElementById('not-found-div');
    if (existingNotFoundDiv) {
        existingNotFoundDiv.remove();
    }

    // Anzeige der nicht gefundenen Artikelnummern im separaten <p> Element
    if (notFoundItems.length > 0) {
        const notFoundDiv = document.createElement('div');
        notFoundDiv.id = 'not-found-div';
        const notFoundParagraph = document.createElement('p');
        notFoundParagraph.innerHTML = `<strong>Diese Artikelnummern wurden nicht gefunden:</strong> ${notFoundItems.join(', ')}`;
        notFoundDiv.appendChild(notFoundParagraph);

        // Füge das not-found-div zwischen upload-form und output ein
        const uploadForm = document.getElementById('upload-form');
        const outputDiv = document.getElementById('output');
        uploadForm.parentNode.insertBefore(notFoundDiv, outputDiv);
    }

    document.getElementById('output').innerHTML = '';
    imageElements = [];
    for (const item of displayedData) {
        await generateHTML(item);
    }

    document.getElementById('download-button').disabled = false;
    document.getElementById('screenshot-button').disabled = false;
}

    async function generateHTML(product) {
		let energyLabel = '';
		if (product.energy_efficiency_class_range && product.energy_efficiency_class) {
			const range = product.energy_efficiency_class_range.trim().toLowerCase().replace(/\s+/g, '').replace(/\+/g, 'p');
			const cls = product.energy_efficiency_class.trim().toLowerCase().replace(/\s+/g, '').replace(/\+/g, 'p');
			const isLamp = product.category_department && product.category_department.trim().toLowerCase() === 'lampen & leuchten';

			const prefix = isLamp ? 'old-' : '';
			const filename = `${prefix}el-${range}-${cls}.png`;

			const imageUrl = `https://chinafreak93.github.io/cs-tools/ee-labels/big/${filename}`;
			energyLabel = `<img class="e-label" src="${imageUrl}">`;
		}

        let customLogoElement = '';
        if (product['custom_logo_url']) {
            customLogoElement = `<img class="logo" src="${await getImageAsBase64(product['custom_logo_url'])}">`;
        }

        let productTitle = product.title.split(' - ')[0];
        if (productTitle.startsWith(product.brand)) {
            productTitle = productTitle.slice(product.brand.length).trim();
        }

	let brandLogoUrl = product.brand_logo;
	if (!brandLogoUrl || brandLogoUrl.trim() === '') {
	    brandLogoUrl = generateFallbackLogoUrl(product.brand);
	    console.log('⚠️ Fallback-Brand-Logo verwendet für', product.brand, '→', brandLogoUrl);
	    product.brand_logo = brandLogoUrl;
	}
	brandLogoUrl = await getImageAsBase64(brandLogoUrl);
		
		const rawStrike = parseFloat(product.strikeprice);
		const rawPrice = parseFloat(product.price);

		// 2. Rabatt-Berechnung auf Basis der Rohwerte
		function calculateDiscountPercentage(strike, price) {
			if (strike && price && strike > 0) {
				return Math.floor(((strike - price) / strike) * 100);
			}
			return 0;
		}

		const discountPercentage = calculateDiscountPercentage(rawStrike, rawPrice);
		const percentPlaceholder = `${discountPercentage}%`;

		// 3. ERST danach Preise formatieren
		const formattedStrikePrice = rawStrike ? formatPrice(rawStrike) : '';
		const formattedPrice = formatPrice(rawPrice);

		// 4. Bisherige Logik geht danach normal weiter
		let hasStrikePrice = formattedStrikePrice && discountPercentage > 0;

		let priceBoxClass = 'price-box';
		if (!hasStrikePrice) {
			priceBoxClass += ' no-strikeprice';
		} else if (discountPercentage <= 4) {
			priceBoxClass += ' low-discount';
		}
		
        let htmlContent = `
        <div class="tagesangebot-outer">
            <a href="https://www.mediamarkt.ch/de/product/_-${product.sku}.html" target="_blank" class="tagesangebot-img" data-sku="${product.sku}-${imageElements.length}">
                <div class="slider-inner">
                    <div class="right-side">
                        <img class="prod-img" src="${await getImageAsBase64(product.image_link)}">
                        <div class="prod-info">
                            <div class="prod-info-top">
                                ${energyLabel}
								<div class="${priceBoxClass}">
								<div class="before-price">
									${hasStrikePrice ? `<div class="percent">-${discountPercentage}%</div>` : ''}
									${formattedStrikePrice ? `<span class="strikeprice">CHF ${formattedStrikePrice}</span>` : ''}
								</div>
								<span class="price">CHF ${formattedPrice}</span>
								</div>
                                <span class="brand">${product.brand}</span>
                                <span class="info-1">${productTitle}</span>
                            </div>
                            <div class="outer-logo">
                                <img class="brand-logo" src="${brandLogoUrl}">
                                ${customLogoElement}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
			</a>
        </div>
        `;

        const outputDiv = document.createElement('div');
        outputDiv.innerHTML = htmlContent;
        document.getElementById('output').appendChild(outputDiv);
        imageElements.push(outputDiv.querySelector('.tagesangebot-img'));
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;  
        }
    }

console.log('✔️ generateFallbackLogoUrl wurde geladen');

function generateFallbackLogoUrl(brand) {
    brand = brand.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
    return `https://chinafreak93.github.io/cs-tools/brandlogos/${brand}.png`;
}

async function getImageAsBase64(url) {
    try {
        console.log('🔍 Lade Bild von:', url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP-Fehler ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error('❌ Bild konnte nicht geladen werden:', url, err);
        return ''; // oder ein Platzhalterbild: return 'fallback.png';
    }
}

    function formatPrice(price) {
        if (!price) return '';
        price = price.toString();
        if (price.includes('.')) {
            let [integerPart, decimalPart] = price.split('.');
            if (decimalPart === '0' || decimalPart === '00') {
                return `${integerPart}.-`;
            } else if (decimalPart === '-') {
                return `${integerPart}.-`;
            } else {
                return `${integerPart}.<sup>${decimalPart}</sup>`;
            }
        } else if (price.includes('-')) {
            return price;
        } else {
            return `${price}.-`;
        }
    }

    document.getElementById('download-button').addEventListener('click', function() {
        const requiredFields = ["sku", "brand", "title", "price", "strikeprice", "image_link", "brand_logo", "energy_efficiency_class","energy_efficiency_class_range", "category_department", "custom_logo_url"];

        const formattedData = displayedData.map(item => {
            const newItem = {};
            requiredFields.forEach(field => {
                newItem[field] = item[field] || '';  // Setze den Feldwert auf eine leere Zeichenkette, wenn er nicht vorhanden ist
            });
            return newItem;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(formattedData, {header: requiredFields});
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, 'displayed_data.xlsx');
    });

	document.getElementById('screenshot-button').addEventListener('click', async function() {
		const zip = new JSZip();

		for (const element of imageElements) {
			const fullSku = element.getAttribute('data-sku'); // z. B. 12345-0, 12345-1

			const canvas = await html2canvas(element, { scale: 1 });
			let dataUrl = canvas.toDataURL('image/jpeg', 1.0);

			let quality = 1.0;
			let base64Data = dataUrl.split(',')[1];
			while (base64Data.length * 0.75 > 150 * 1024 && quality > 0.1) {
				quality -= 0.05;
				dataUrl = canvas.toDataURL('image/jpeg', quality);
				base64Data = dataUrl.split(',')[1];
			}

			zip.file(`${fullSku}.jpg`, base64Data, { base64: true });
		}

		zip.generateAsync({ type: 'blob' }).then(function(content) {
			saveAs(content, 'screenshots.zip');
		});
	});

    document.getElementById('template-button').addEventListener('click', function() {
        const link = document.createElement('a');
        link.href = 'tagesangebot-mit-csv-vorlage.xlsx';
        link.download = 'tagesangebot-mit-csv-vorlage.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

        document.getElementById('reset-button').addEventListener('click', function() {
            document.getElementById('file').value = '';
            document.getElementById('output').innerHTML = '';
            displayedData = [];
            imageElements = [];
            document.getElementById('download-button').disabled = true;
            document.getElementById('screenshot-button').disabled = true;
            document.getElementById('download-button').style.display = 'none';
            document.getElementById('screenshot-button').style.display = 'none';
            document.getElementById('reset-button').style.display = 'none';
            
            // Entfernt das div mit der ID not-found-div, falls es existiert
            const notFoundDiv = document.getElementById('not-found-div');
            if (notFoundDiv) {
                notFoundDiv.remove();
            }
        });
	 
	 	const dropZone = document.getElementById('drop-zone');

		dropZone.addEventListener('click', () => {
			document.getElementById('file').click();
		});

		dropZone.addEventListener('dragover', (e) => {
			e.preventDefault();
			dropZone.classList.add('dragover');
		});

		dropZone.addEventListener('dragleave', () => {
			dropZone.classList.remove('dragover');
		});

		dropZone.addEventListener('drop', (e) => {
			e.preventDefault();
			dropZone.classList.remove('dragover');

			const files = e.dataTransfer.files;
			if (files.length > 0) {
				document.getElementById('file').files = files;

				const event = new Event('change');
				document.getElementById('file').dispatchEvent(event);
			}
		});

function checkScreenWidth() {
    const warning = document.getElementById('screen-warning');
    if (window.innerWidth < 1094) {
        warning.textContent = '⚠️ Dein Browser-Fenster ist zu schmal. Bitte auf mindestens 1094px vergrössern, um das ganze Tagesangebot korrekt zu generieren.';
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }
}

window.addEventListener('DOMContentLoaded', checkScreenWidth);
window.addEventListener('resize', checkScreenWidth);
