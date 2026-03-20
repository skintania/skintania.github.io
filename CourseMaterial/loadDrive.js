// script.js
document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('coursesGrid');
    const breadcrumbContainer = document.getElementById('breadcrumbContainer');
    const backBtn = document.getElementById('backBtn');
    const currentPathText = document.getElementById('currentPathText');

    let rootData = [];
    let folderHistory = []; 
    let pathNames = ["Home"]; 

    // --- SETUP PDF.JS WORKER ---
    // This is required for PDF.js to run processes in the background without freezing the page
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    fetch('/CourseMaterial/MaterialLink.json')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load data.json');
            return response.json();
        })
        .then(data => {
            rootData = data;
            renderGrid(rootData); 
        })
        .catch(error => {
            console.error(error);
            gridContainer.innerHTML = '<p style="color: red;">Error loading data.</p>';
        });

    function renderGrid(items) {
        gridContainer.innerHTML = ''; 

        if (folderHistory.length > 0) {
            breadcrumbContainer.style.display = 'flex';
            currentPathText.textContent = pathNames.join(' > '); 
        } else {
            breadcrumbContainer.style.display = 'none';
        }

        items.forEach(item => {
            if (item.type === 'folder') {
                const folderIcon = item.icon || 'fa-solid fa-folder';
                const card = createCard(item.name, folderIcon);
                
                card.addEventListener('click', () => {
                    folderHistory.push(items); 
                    pathNames.push(item.name); 
                    renderGrid(item.contents); 
                });
                
                gridContainer.appendChild(card);
            } 
            else if (item.type === 'file') {
                const cardLink = document.createElement('a');
                cardLink.className = 'drive-card';
                cardLink.href = item.link;
                cardLink.target = '_blank'; 

                // Create the containers manually so we can target them easily for the PDF generation
                const iconDiv = document.createElement('div');
                iconDiv.className = 'drive-icon';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'drive-name';
                nameDiv.textContent = item.name;

                const extension = item.name.split('.').pop().toLowerCase();
                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

                if (imageExtensions.includes(extension)) {
                    iconDiv.innerHTML = `<img src="${item.link}" alt="${item.name}" class="file-preview-img" />`;
                } else if (extension === 'pdf') {
                    // 1. Show a loading spinner temporarily
                    iconDiv.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: #aaa;"></i>`;
                    // 2. Call our async function to load the PDF and replace the spinner
                    generatePDFPreview(item.link, iconDiv);
                } else {
                    const fileIcon = item.icon || 'fa-solid fa-file-lines'; 
                    iconDiv.innerHTML = `<i class="${fileIcon}"></i>`;
                }

                cardLink.appendChild(iconDiv);
                cardLink.appendChild(nameDiv);
                gridContainer.appendChild(cardLink);
            }
        });
    }

    function createCard(name, iconClass) {
        const div = document.createElement('div');
        div.className = 'drive-card';
        div.innerHTML = `
            <div class="drive-icon"><i class="${iconClass}"></i></div>
            <div class="drive-name">${name}</div>
        `;
        return div;
    }

    // --- NEW PDF PREVIEW FUNCTION ---
    async function generatePDFPreview(pdfUrl, containerElement) {
        try {
            // Fetch the PDF document
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            
            // Get the first page
            const page = await pdf.getPage(1);
            
            // Set the scale (0.5 is usually fine for a thumbnail, saves memory)
            const viewport = page.getViewport({ scale: 0.5 });
            
            // Create a canvas element to draw the PDF onto
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Apply the same CSS class we used for images so it fits nicely in the box
            canvas.className = 'file-preview-img'; 

            // Render the PDF page onto the canvas
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;

            // Clear the loading spinner and insert the canvas thumbnail
            containerElement.innerHTML = '';
            containerElement.appendChild(canvas);

        } catch (error) {
            console.error('Error generating PDF preview for:', pdfUrl, error);
            // --- UPDATED: Fall back to a standard document icon instead of a PDF icon ---
            containerElement.innerHTML = `<i class="fa-solid fa-file-lines"></i>`;
        }
    }

    backBtn.addEventListener('click', () => {
        if (folderHistory.length > 0) {
            const previousItems = folderHistory.pop(); 
            pathNames.pop(); 
            renderGrid(previousItems); 
        }
    });
});