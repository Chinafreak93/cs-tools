// JavaScript Document

 let csvData = [];
        let excelData = [];
        let displayedData = [];
        let imageElements = [];
        let skuCount = {};

        Papa.parse('https://chinafreak93.github.io/cs-tools/shop-data.csv', {
            download: true,
            header: true,
            complete: function(results) {
                csvData = results.data;
                console.log('CSV Daten geladen:', csvData);
            }
        });

        function excelDateToJSDate(excelDate) {
            const jsDate = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
            const day = String(jsDate.getDate()).padStart(2, '0');
            const month = String(jsDate.getMonth() + 1).padStart(2, '0');
            const year = jsDate.getFullYear();
            return `${day}.${month}.${year}`;
        }

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
                            if (headers[index].toLowerCase() === 'date' && !isNaN(cell)) {
                                obj[headers[index]] = excelDateToJSDate(cell);
                            } else {
                                obj[headers[index]] = cell ? cell.toString() : '';
                            }
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
            skuCount = {};

            for (const excelItem of excelData) {
                const excelSku = excelItem.sku ? excelItem.sku.toString().trim() : '';
                const csvItem = csvData.find(item => item.sku && item.sku.toString().trim() === excelSku);
                if (csvItem) {
                    console.log('Übereinstimmendes Produkt gefunden:', csvItem);
                    let mergedItem = { ...csvItem, ...excelItem };
                    displayedData.push(mergedItem);
                } else {
                    console.log('Produkt in CSV nicht gefunden:', excelSku);
                    displayedData.push(excelItem);
                }
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
            if (product.energy_efficiency_class) {
                if (isValidUrl(product.energy_efficiency_class)) {
                    energyLabel = `<img class="e-label" src="${product.energy_efficiency_class}">`;
                } else {
                    energyLabel = `<img class="e-label" src="https://mmeshopcustom.blob.core.windows.net/mediamarkt-ch/contentful/tagesdeal-generator/ee-labels/big/EEK_${product.energy_efficiency_class}_Spektrum_A_G.png">`;
                }
            }

            let customLogoElement = '';
            if (product['custom_logo_url']) {
                customLogoElement = `<img class="logo" src="${await getImageAsBase64(product['custom_logo_url'])}">`;
            }

            const formattedStrikePrice = product.strikeprice ? formatPrice(product.strikeprice) : '';
            const formattedPrice = formatPrice(product.price);

            let productTitle = product.title ? product.title.split(' - ')[0] : '';
            if (product.brand && productTitle.startsWith(product.brand)) {
                productTitle = productTitle.slice(product.brand.length).trim();
            }
            
            let brandLogoUrl = product.brand_logo;
            if (!brandLogoUrl && product.brand) {
                brandLogoUrl = generateFallbackLogoUrl(product.brand);
                product.brand_logo = brandLogoUrl;
            }
            brandLogoUrl = brandLogoUrl ? await getImageAsBase64(brandLogoUrl) : '';

            let promoImage = '';
            if (product.promo) {
                const promoImageUrl = `https://mmeshopcustom.blob.core.windows.net/mediamarkt-ch/entry-screens-with-csv/pos-wallpaper-top/${getPromoImageName(product.promo)}.jpg`;
                promoImage = `<img class="promo-img" src="${promoImageUrl}">`;
            }

            let legalTextElement = '';
            if (product.legaltext) {
                const formattedLegalText = product.legaltext.replace('{date}', product.date || '');
                legalTextElement = `<div class="legal-text">${formattedLegalText}</div>`;
            }

            let headlineElement = product.headline ? `<div class="headline">${product.headline}</div>` : '';

            let htmlContent = `
            <div class="tagesangebot-outer">
                <div class="tagesangebot-img" data-sku="${product.sku || ''}">
                    <div class="slider-inner">
                        ${promoImage}
                        <div class="right-side">
                            ${headlineElement}
                            <img class="prod-img" src="${product.image_link ? await getImageAsBase64(product.image_link) : ''}">
                            <div class="prod-info">
                                <div class="prod-info-top">
                                    ${energyLabel}
                                    ${formattedStrikePrice ? `<span class="strikeprice">${formattedStrikePrice}</span>` : ''}
                                    <span class="price">${formattedPrice}</span>
                                    <span class="brand">${product.brand || ''}</span>
                                    <span class="info-1">${productTitle}</span>
                                </div>
                                <div class="outer-logo">
                                    <img class="brand-logo" src="${brandLogoUrl}">
                                    ${customLogoElement}
                                </div>
                                ${legalTextElement}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;

            const outputDiv = document.createElement('div');
            outputDiv.innerHTML = htmlContent;
            document.getElementById('output').appendChild(outputDiv);
            imageElements.push(outputDiv.querySelector('.tagesangebot-img'));
        }

        function getPromoImageName(promoValue) {
            const promoMapping = {
                'td_de': 'Tagesangebot_DE',
                'td_fr': 'Tagesangebot_FR',
                'td_it': 'Tagesangebot_IT',
                'wd_de': 'Wochenangebot_DE',
                'wd_fr': 'Wochenangebot_FR',
                'wd_it': 'Wochenangebot_IT',
				'xmas_de' : 'xmas_DE',
				'xmas_fr' : 'xmas_FR',
				'xmas_it' : 'xmas_IT',
            };
            return promoMapping[promoValue] || '';
        }

        function isValidUrl(string) {
            try {
                new URL(string);
                return true;
            } catch (_) {
                return false;  
            }
        }

        function generateFallbackLogoUrl(brand) {
            brand = brand.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
            return `https://mmeshopcustom.blob.core.windows.net/mediamarkt-ch/cms/brandlogos/${brand}.png`;
        }

        async function getImageAsBase64(url) {
            if (!url) return '';
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
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
            const requiredFields = ["sku", "brand", "title", "price", "strikeprice", "image_link", "brand_logo", "energy_efficiency_class", "custom_logo_url", "promo", "legaltext", "date", "headline"];

            const formattedData = displayedData.map(item => {
                const newItem = {};
                requiredFields.forEach(field => {
                    newItem[field] = item[field] || '';
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
            skuCount = {};

            for (const element of imageElements) {
                const sku = element.getAttribute('data-sku');
                const promo = element.querySelector('.promo-img') ? element.querySelector('.promo-img').getAttribute('src').split('/').pop().split('.')[0] : ''; 

                const imageName = promo ? `${sku}_${promo}.jpg` : `${sku}.jpg`;

                await html2canvas(element, { scale: 1 }).then(canvas => {
                    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
                    const base64Data = dataUrl.split(',')[1];
                    zip.file(imageName, base64Data, { base64: true });
                });
            }

            zip.generateAsync({ type: 'blob' }).then(function(content) {
                saveAs(content, 'screenshots.zip');
            });
        });

        document.getElementById('template-button').addEventListener('click', function() {
            const link = document.createElement('a');
            link.href = 'https://mmeshopcustom.blob.core.windows.net/mediamarkt-ch/entry-screens-with-csv/entry-screen-mit-csv-vorlage.xlsx';
            link.download = 'entry-screen-mit-csv-vorlage.xlsx';
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
