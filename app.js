const scaleFactor = 10; // Scale factor for enlarging each pixel

// Global variable to store palette indices
let storedPaletteIndices = new Array(32 * 32).fill(1);
let monoPixelStates = new Array(32 * 32).fill(false); // Initialize all pixels to "off" (white)

// Global variable to store the current palette
let currentPalette = [];

// Global variables for color selection
let primaryColor = '#000000FF'; // Default primary color
let secondaryColor = '#FFFFFFFF'; // Default secondary color
let primaryColorIndex = 0; // Default index for primary color
let secondaryColorIndex = 1; // Default index for secondary color

// Add these global variables near the top with other globals
let monoDrawPrimary = true; // true = draw black/on, false = draw transparent/off
let monoDrawSecondary = false;

// Add these global variables near the top with other globals
let monoPaletteStates = new Array(16).fill(false); // Track toggle state for each palette index

// Add the 3D mode byte sequence constant
const THREED_MODE_SEQUENCE = new Uint8Array([
    0xda, 0x69, 0xd0, 0xda, 0xc7, 0x4e, 0xf8, 0x36,
    0x18, 0x92, 0x79, 0x68, 0x2d, 0xb5, 0x30, 0x86
]);

document.getElementById('color-file').addEventListener('change', function(event) {
  handleFile(event, 'color');
});

document.getElementById('mono-file').addEventListener('change', function(event) {
  handleFile(event, 'mono');
});

document.getElementById('unified-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    handleFileInput(file);
});

function handleFileInput(file) {
    if (!file) return;

    const extension = file.name.toLowerCase().split('.').pop();
    const description = file.name.split('.')[0].slice(0, 16).toUpperCase();

    if (extension === 'vms') {
        // Handle VMS file
        const reader = new FileReader();
        reader.onload = function(e) {
            const vmsData = new Uint8Array(e.target.result);
            parseVMSFile(vmsData);
        };
        reader.readAsArrayBuffer(file);
    } else if (extension === 'dci') {
        // Handle DCI file
        const reader = new FileReader();
        reader.onload = function(e) {
            const dciData = new Uint8Array(e.target.result);
            parseDCIFile(dciData);
        };
        reader.readAsArrayBuffer(file);
    } else if (extension === 'dcm') {
        // Handle DCM file
        const reader = new FileReader();
        reader.onload = function(e) {
            const dcmData = new Uint8Array(e.target.result);
            parseDCMFile(dcmData);
        };
        reader.readAsArrayBuffer(file);
    } else if (extension === 'psv') {
        // Handle PSV file
        const reader = new FileReader();
        reader.onload = function(e) {
            const psvData = new Uint8Array(e.target.result);
            parsePSVFile(psvData);
        };
        reader.readAsArrayBuffer(file);
    } else if (['ico', 'bmp', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
        // Handle image file - process both color and mono
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                processColorImage(img);
                processMonoImage(img);
                document.getElementById('description').value = description;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        alert('Unsupported file type. Please use VMS or image files (PNG, JPG, GIF, WEBP).');
    }

    // Clear the file input after parsing
    const fileInput = document.getElementById('unified-file');
    if (fileInput) fileInput.value = ''; // Clear the file input
}

document.getElementById('save-button').addEventListener('click', saveVMSVMI);

function handleFile(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
          if (type === 'color') {
              processColorImage(img);
          } else {
              processMonoImage(img);
          }
      };
      img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

let redInput = document.getElementById('red');
let greenInput = document.getElementById('green');
let blueInput = document.getElementById('blue');
let alphaInput = document.getElementById('alpha');

const colorPreview = document.getElementById('color-preview');
const customColorPicker = document.getElementById('custom-color-picker');

let currentPaletteIndex = null;
let lastRightClickTime = 0;
const doubleClickThreshold = 200; // Reduced time in milliseconds

const hueSlider = document.getElementById('hue-slider');
const colorPickerCanvas = document.getElementById('color-picker-canvas');
const hueCtx = hueSlider.getContext('2d', { willReadFrequently: true });
const colorCtx = colorPickerCanvas.getContext('2d', { willReadFrequently: true });
let currentHue = 0;
let isColorPickerDragging = false;
let isHueSliderDragging = false;
let colorIndicatorX = colorPickerCanvas.width - 1; // Default to the furthest right position
let colorIndicatorY = 0; // Default to the top position

// Add a variable to track the hue indicator position
let hueIndicatorX = 0;

// Add these variables near the other slider-related variables
const opacitySlider = document.getElementById('opacity-slider');
const opacityCtx = opacitySlider.getContext('2d', { willReadFrequently: true });
let opacityIndicatorX = opacitySlider.width; // Default to full opacity

function rgbaToHex(r, g, b, a) {
    const hexR = (r & 0xFF).toString(16).padStart(2, '0');
    const hexG = (g & 0xFF).toString(16).padStart(2, '0');
    const hexB = (b & 0xFF).toString(16).padStart(2, '0');
    const hexA = (a & 0xFF).toString(16).padStart(2, '0');
    return `#${hexR}${hexG}${hexB}${hexA}`.toUpperCase();
}

// Convert HSB to RGB
function hsbToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return [r * 255, g * 255, b * 255];
}

// Update the drawHueSlider function
function drawHueSlider() {
    const width = hueSlider.width;
    const gradient = hueCtx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'red');
    gradient.addColorStop(0.17, 'yellow');
    gradient.addColorStop(0.34, 'lime');
    gradient.addColorStop(0.51, 'cyan');
    gradient.addColorStop(0.68, 'blue');
    gradient.addColorStop(0.85, 'magenta');
    gradient.addColorStop(1, 'red');

    hueCtx.fillStyle = gradient;
    hueCtx.fillRect(0, 0, width, hueSlider.height);

    // Calculate the color for the current hue
    const [r, g, b] = hsbToRgb(hueIndicatorX / width, 1, 1);

    // Add shadow before drawing the indicator
    hueCtx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    hueCtx.shadowBlur = 1;
    hueCtx.shadowOffsetX = 1;

    // Draw the hue indicator with the selected color
    hueCtx.beginPath();
    hueCtx.arc(hueIndicatorX, hueSlider.height / 2, hueSlider.height / 2, 0, Math.PI * 2);
    hueCtx.fillStyle = `rgb(${r}, ${g}, ${b})`; 
    hueCtx.fill();
    hueCtx.strokeStyle = 'white';
    hueCtx.lineWidth = 3;
    hueCtx.stroke();

    // Reset shadow settings
    hueCtx.shadowColor = 'transparent';
    hueCtx.shadowBlur = 0;
    hueCtx.shadowOffsetX = 0;
}

// Draw the color canvas based on the selected hue
function drawColorCanvas(hue) {
    const width = colorPickerCanvas.width;
    const height = colorPickerCanvas.height;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const saturation = x / width;
            const brightness = 1 - y / height;
            const [r, g, b] = hsbToRgb(hue, saturation, brightness);

            // Quantize to 4-bit color depth
            const quantizedR = Math.round(r / 255 * 15) * 17;
            const quantizedG = Math.round(g / 255 * 15) * 17;
            const quantizedB = Math.round(b / 255 * 15) * 17;

            colorCtx.fillStyle = `rgb(${quantizedR}, ${quantizedG}, ${quantizedB})`;
            colorCtx.fillRect(x, y, 1, 1);
        }
    }
}

// Draw the selection circle
function drawCircle(x, y) {
    colorCtx.beginPath();
    colorCtx.arc(x, y, 6, 0, Math.PI * 2);
    colorCtx.strokeStyle = 'white';
    colorCtx.lineWidth = 3;
    colorCtx.stroke();
}

function getStoredPaletteIndices() {
    // Ensure this function returns the correct indices for the current canvas state
    return storedPaletteIndices; // Make sure this is correctly populated elsewhere in your code
}

function updateCanvasWithPalette(palette) {
    // console.log('Updating canvas with new palette');
    const canvas = document.getElementById('color-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const originalWidth = 32;
    const originalHeight = 32;
    const imageData = ctx.createImageData(originalWidth, originalHeight);
    const data = imageData.data;

    // Assuming you have a stored array of palette indices for each pixel
    const paletteIndices = getStoredPaletteIndices(); // Implement this function to retrieve stored indices

    for (let i = 0; i < paletteIndices.length; i++) {
        const index = paletteIndices[i]; // Get the palette index for this pixel

        // Check if the index is valid
        if (index >= 0 && index < palette.length) {
            const color = palette[index]; // Get the new color from the updated palette

            if (color) {
                const pixelIndex = i * 4;
                data[pixelIndex] = color.r;
                data[pixelIndex + 1] = color.g;
                data[pixelIndex + 2] = color.b;
                data[pixelIndex + 3] = color.a; // Ensure alpha is also updated
            }
        }
    }

    // Draw the updated 32x32 image data onto the canvas
    ctx.putImageData(imageData, 0, 0);

    // Scale the 32x32 image data to the full canvas size
    const scaledImageData = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < originalHeight; y++) {
        for (let x = 0; x < originalWidth; x++) {
            const originalIndex = (y * originalWidth + x) * 4;
            for (let dy = 0; dy < scaleFactor; dy++) {
                for (let dx = 0; dx < scaleFactor; dx++) {
                    const scaledIndex = ((y * scaleFactor + dy) * canvas.width + (x * scaleFactor + dx)) * 4;
                    scaledImageData.data[scaledIndex] = data[originalIndex];
                    scaledImageData.data[scaledIndex + 1] = data[originalIndex + 1];
                    scaledImageData.data[scaledIndex + 2] = data[originalIndex + 2];
                    scaledImageData.data[scaledIndex + 3] = data[originalIndex + 3];
                }
            }
        }
    }

    ctx.putImageData(scaledImageData, 0, 0);
    // console.log('Canvas updated with new palette');
}

function resetColorPickerIndicators(r, g, b, a) {
    const [hue, saturation, brightness] = rgbToHsb(r, g, b);

    // Update the hue indicator position
    hueIndicatorX = hue * hueSlider.width;
    currentHue = hue;
    drawHueSlider();

    // Update the opacity indicator position
    opacityIndicatorX = (a / 255) * opacitySlider.width;
    drawOpacitySlider();

    // Update the color indicator positions
    colorIndicatorX = Math.max(0, Math.min(saturation * colorPickerCanvas.width, colorPickerCanvas.width - 1));
    colorIndicatorY = Math.max(0, Math.min((1 - brightness) * colorPickerCanvas.height, colorPickerCanvas.height - 1));

    drawColorCanvas(currentHue);
    drawCircle(colorIndicatorX, colorIndicatorY);
}

function updateColorPreview(event) {
    const r = parseInt(redInput.value) * 17; // Scale 4-bit to 8-bit
    const g = parseInt(greenInput.value) * 17;
    const b = parseInt(blueInput.value) * 17;
    const a = parseInt(alphaInput.value) * 17; // Scale 4-bit to 8-bit

    colorPreview.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;

    // Apply the color change immediately
    if (currentPaletteIndex !== null) {
        currentPalette[currentPaletteIndex] = { r, g, b, a };
        updateCanvasWithPalette(currentPalette);
        displayColorPalette(currentPalette);

        // Update primary or secondary color if necessary
        if (currentPaletteIndex === primaryColorIndex) {
            primaryColor = rgbaToHex(r, g, b, a);
            updateColorIndicators();
        }
        if (currentPaletteIndex === secondaryColorIndex) {
            secondaryColor = rgbaToHex(r, g, b, a);
            updateColorIndicators();
        }

        // Reset the color-picker-canvas and hue slider indicators 
        // only if the color is changed by color form inputs.
        if (event) resetColorPickerIndicators(r, g, b, a);
    }
}

function showColorPicker(index, event) {
    console.log(`Opening color picker for index: ${index}`);
    currentPaletteIndex = index;
    const color = currentPalette[index];

    // Convert the current color to HSB
    const [hue, saturation, brightness] = rgbToHsb(color.r, color.g, color.b);

    // Update the hue indicator position
    hueIndicatorX = hue * hueSlider.width;
    currentHue = hue;
    drawHueSlider();

    // Update the color indicator positions
    colorIndicatorX = Math.max(0, Math.min(saturation * colorPickerCanvas.width, colorPickerCanvas.width - 1));
    colorIndicatorY = Math.max(0, Math.min((1 - brightness) * colorPickerCanvas.height, colorPickerCanvas.height - 1));

    drawColorCanvas(currentHue);
    drawCircle(colorIndicatorX, colorIndicatorY);

    // Update the color preview and inputs
    redInput.value = color.r / 17;
    greenInput.value = color.g / 17;
    blueInput.value = color.b / 17;
    alphaInput.value = color.a / 17;
    updateColorPreview();

    // Position the color picker
    const rect = document.getElementById('color-palette-item-index-' + index).getBoundingClientRect();
    const topPosition = rect.bottom;
    const leftPosition = rect.left;

    if (customColorPicker) {
        customColorPicker.style.position = 'fixed';
        customColorPicker.style.top = `${topPosition}px`;
        customColorPicker.style.left = `${leftPosition}px`;
        customColorPicker.style.display = 'block';
    } else {
        console.error('customColorPicker element not found');
    }

    // Set the opacity slider position based on the alpha value
    opacityIndicatorX = (color.a / 255) * opacitySlider.width;
    drawOpacitySlider();
}

function hexToRgba(hex) {
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return match ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16), a: parseInt(match[4], 16) } : null;
}

function hexToRgbaString(hex) {
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return match ? `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${parseInt(match[4], 16) / 255})` : null;
}

function updateColorIndicators() {
    const primaryIndicator = document.getElementById('primary-color-indicator');
    const secondaryIndicator = document.getElementById('secondary-color-indicator');
    primaryIndicator.style.backgroundColor = hexToRgbaString(primaryColor);
    secondaryIndicator.style.backgroundColor = hexToRgbaString(secondaryColor);
}

// Add events to each color in the palette
function attachPaletteEvents() {
    document.querySelectorAll('#color-palette div').forEach((colorDiv, index) => {
        colorDiv.addEventListener('dblclick', (e) => {
            e.preventDefault(); // Prevent the native color picker
            showColorPicker(index, e); // Pass the event object
        });

        // Single click to set primary color
        colorDiv.addEventListener('click', (e) => {
            if (e.button === 0) { // Left click
                primaryColor = rgbaToHex(currentPalette[index].r, currentPalette[index].g, currentPalette[index].b, currentPalette[index].a);
                primaryColorIndex = index;
                updateColorIndicators();
            }
        });

        // Handle right-click for secondary color and double right-click for picker
        colorDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const currentTime = new Date().getTime();

            if (currentTime - lastRightClickTime < doubleClickThreshold) {
                showColorPicker(index, e); // Open picker on double right-click
            } else {
                secondaryColor = rgbaToHex(currentPalette[index].r, currentPalette[index].g, currentPalette[index].b, currentPalette[index].a);
                secondaryColorIndex = index;
                updateColorIndicators();
            }

            lastRightClickTime = currentTime;
        });
    });
}

function displayColorPalette(palette) {
    const paletteContainer = document.getElementById('color-palette');
    paletteContainer.innerHTML = ''; // Clear previous palette

    const squareSize = 24; // Size of each color square
    const columns = 8; // Number of columns in the grid
    const gap = '0 0'; // Gap between squares
    const borderSize = 1;

    // Calculate the total width of the palette container
    const totalWidth = columns * (squareSize + gap) - gap; // Subtract the last gap

    // Set the palette container to display as a grid
    paletteContainer.style.display = 'grid';
    paletteContainer.style.gridTemplateColumns = `repeat(${columns}, ${squareSize+(borderSize*2)}px)`;
    paletteContainer.style.gap = `${gap}px`;
    paletteContainer.style.width = `${totalWidth}px`;
    paletteContainer.style.border = `${borderSize}px solid #000`;
    paletteContainer.style.borderRadius = '2px';

    palette.forEach((color, index) => {
        const colorDiv = document.createElement('div');
        colorDiv.style.width = `${squareSize}px`;
        colorDiv.style.height = `${squareSize}px`;
        colorDiv.style.backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        colorDiv.style.cursor = 'pointer';
        colorDiv.style.border = '1px solid #000'; // Optional: Add a border for better visibility
        colorDiv.style.position = 'relative'; // Position relative to allow absolute positioning of the input
        colorDiv.id = 'color-palette-item-index-' + index;

        // Create a color input element
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = rgbaToHex(color.r, color.g, color.b, color.a).slice(0, 7); // Use only RGB for the color input
        colorInput.style.position = 'absolute';
        colorInput.style.top = '0';
        colorInput.style.left = '0';
        colorInput.style.width = '100%';
        colorInput.style.height = '100%';
        colorInput.style.opacity = '0'; // Hide the input visually but keep it accessible
        colorInput.style.pointerEvents = 'none'; // Disable pointer events to prevent single click

        // Store the alpha value as a data attribute
        colorInput.setAttribute('data-alpha', (color.a & 0xFF).toString(16).padStart(2, '0'));

        // Single click to set primary color
        colorDiv.addEventListener('click', (e) => {
            if (e.button === 0) { // Left click
                const alphaHex = colorInput.getAttribute('data-alpha');
                primaryColor = colorInput.value + alphaHex; // Append the alpha value
                primaryColorIndex = index;
                updateColorIndicators();
            }
        });

        // Right click to set secondary color
        colorDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const alphaHex = colorInput.getAttribute('data-alpha');
            secondaryColor = colorInput.value + alphaHex; // Append the alpha value
            secondaryColorIndex = index;
            updateColorIndicators();
        });

        // Add change event to update color
        colorInput.addEventListener('input', () => {
            const newColor = colorInput.value + 'FF'; // Append full opacity
            const rgba = hexToRgba(newColor);
            if (rgba) {
                console.log(`Updating color index ${index} to`, rgba);
                color.r = rgba.r;
                color.g = rgba.g;
                color.b = rgba.b;
                color.a = rgba.a;
                colorDiv.style.backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;

                // Update the canvas with the new palette
                updateCanvasWithPalette(currentPalette);

                // Update the color indicators if this color is selected
                if (index === primaryColorIndex) {
                    primaryColor = newColor;
                    updateColorIndicators();
                }
                if (index === secondaryColorIndex) {
                    secondaryColor = newColor;
                    updateColorIndicators();
                }
            }
        });

        colorDiv.appendChild(colorInput);
        paletteContainer.appendChild(colorDiv);
    });

    // Update color indicators based on the new palette
    if (primaryColorIndex >= palette.length) {
        primaryColorIndex = 0; // Reset to first color if out of bounds
    }
    if (secondaryColorIndex >= palette.length) {
        secondaryColorIndex = 1; // Reset to second color if out of bounds
    }

    primaryColor = rgbaToHex(palette[primaryColorIndex].r, palette[primaryColorIndex].g, palette[primaryColorIndex].b, palette[primaryColorIndex].a);
    secondaryColor = rgbaToHex(palette[secondaryColorIndex].r, palette[secondaryColorIndex].g, palette[secondaryColorIndex].b, palette[secondaryColorIndex].a);
    updateColorIndicators();

    // Store the current palette
    currentPalette = palette;

    attachPaletteEvents();
}

function processColorImage(img) {
  // Create an invisible 32x32 canvas
  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = 32;
  hiddenCanvas.height = 32;
  const hiddenCtx = hiddenCanvas.getContext('2d');

  // Draw the image onto the 32x32 canvas
  hiddenCtx.drawImage(img, 0, 0, 32, 32);

  // Extract image data from the 32x32 canvas
  const imageData = hiddenCtx.getImageData(0, 0, 32, 32);
  const colors = extractColors(imageData);

  // Check if transparent color exists in the image
  const transparentColor = { r: 255, g: 255, b: 255, a: 0 };
  const hasTransparent = colors.some(color => color.a === 0);

  // Reduce the color palette to 16 colors
  let reducedPalette = reducePalette(colors, hasTransparent ? 15 : 16);

  // Quantize colors to 4 bits per channel
  const quantizedColors = reducedPalette.map(color => ({
    r: Math.round((color.r / 255) * 15) * 17,
    g: Math.round((color.g / 255) * 15) * 17,
    b: Math.round((color.b / 255) * 15) * 17,
    a: Math.round((color.a / 255) * 15) * 17,
  }));

  // If transparent color was present, add it to the end of the palette
  if (hasTransparent) {
    quantizedColors.push(transparentColor);
  }

  // Ensure the palette has at least 16 colors
  while (quantizedColors.length < 16) {
    quantizedColors.push(transparentColor);
  }

  // Update the palette indices for each pixel
  storedPaletteIndices = updatePaletteIndices(imageData, quantizedColors);

  // Store the current palette
  currentPalette = quantizedColors;

  // Apply the reduced palette and palette indices to the visible canvas
  applyPaletteToCanvas(storedPaletteIndices, quantizedColors);

  displayColorPalette(quantizedColors);

  // Add this at the end
  updateMonoPaletteStates();
}

function applyPaletteToCanvas(paletteIndices, palette) {
  const canvas = document.getElementById('color-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.createImageData(32, 32);

  for (let i = 0; i < paletteIndices.length; i++) {
    const color = palette[paletteIndices[i]];
    if (!color) continue;

    const index = i * 4;
    imageData.data[index] = color.r;
    imageData.data[index + 1] = color.g;
    imageData.data[index + 2] = color.b;
    imageData.data[index + 3] = color.a; // Use the alpha value from the palette
  }

  // Draw the 32x32 image data onto the canvas
  ctx.putImageData(imageData, 0, 0);

  colorCtx.clearRect(0, 0, canvas.width, canvas.height);

  // Scale the 32x32 image data to the full canvas size
  const scaledImageData = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const originalIndex = (y * 32 + x) * 4;
      for (let dy = 0; dy < scaleFactor; dy++) {
        for (let dx = 0; dx < scaleFactor; dx++) {
          const scaledIndex = ((y * scaleFactor + dy) * canvas.width + (x * scaleFactor + dx)) * 4;
          scaledImageData.data[scaledIndex] = imageData.data[originalIndex];
          scaledImageData.data[scaledIndex + 1] = imageData.data[originalIndex + 1];
          scaledImageData.data[scaledIndex + 2] = imageData.data[originalIndex + 2];
          scaledImageData.data[scaledIndex + 3] = imageData.data[originalIndex + 3];
        }
      }
    }
  }

  ctx.putImageData(scaledImageData, 0, 0);
}

function extractColors(imageData) {
  const colors = new Map();
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];
    const color = (r << 16) | (g << 8) | b;
    if (!colors.has(color)) {
      colors.set(color, { r, g, b, a });
    }
  }
  return Array.from(colors.values());
}

function reducePalette(colors, maxColors) {
  const colorsToReduce = colors.filter(color => color.a !== 0);

  while (colorsToReduce.length > maxColors) {
    let minDistance = Infinity;
    let pairToMerge = [0, 1];

    // Find the closest pair of colors
    for (let i = 0; i < colorsToReduce.length; i++) {
      for (let j = i + 1; j < colorsToReduce.length; j++) {
        const distance = colorDistance(colorsToReduce[i], colorsToReduce[j]);
        if (distance < minDistance) {
          minDistance = distance;
          pairToMerge = [i, j];
        }
      }
    }

    // Merge the closest pair
    const [index1, index2] = pairToMerge;
    const mergedColor = averageColor(colorsToReduce[index1], colorsToReduce[index2]);
    colorsToReduce.splice(index2, 1);
    colorsToReduce[index1] = mergedColor;
  }

  return colorsToReduce;
}

function colorDistance(color1, color2) {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
    Math.pow(color1.g - color2.g, 2) +
    Math.pow(color1.b - color2.b, 2)
  );
}

function averageColor(color1, color2) {
  return {
    r: Math.round((color1.r + color2.r) / 2),
    g: Math.round((color1.g + color2.g) / 2),
    b: Math.round((color1.b + color2.b) / 2),
    a: Math.round((color1.a + color2.a) / 2)
  };
}

function updatePaletteIndices(imageData, palette) {
  const indices = [];
  const transparentIndex = palette.findIndex(color => color.a === 0);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];

    if (a === 0) {
      // Assign the transparent index if the pixel is fully transparent
      indices.push(transparentIndex);
    } else {
      // Find the closest palette index for non-transparent pixels
      const index = findClosestPaletteIndex(r, g, b, palette);
      indices.push(index);
    }
  }
  return indices;
}

function findClosestPaletteIndex(r, g, b, palette) {
  let closestIndex = 0;
  let minDistance = Infinity;
  palette.forEach((color, index) => {
    // Only compare non-transparent colors
    if (color.a !== 0) {
      const distance = colorDistance({ r, g, b }, color);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    }
  });
  return closestIndex;
}

function processMonoImage(img) {
    // Create an invisible 32x32 canvas
    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = 32;
    hiddenCanvas.height = 32;
    const hiddenCtx = hiddenCanvas.getContext('2d');

    // Draw the image onto the 32x32 canvas
    hiddenCtx.drawImage(img, 0, 0, 32, 32);

    // Extract image data from the 32x32 canvas
    const imageData = hiddenCtx.getImageData(0, 0, 32, 32);
    const data = imageData.data;

    // Define a threshold for converting to black or transparent
    const threshold = 64; // Adjust this value as needed

    // Get the visible canvas and its context
    const canvas = document.getElementById('mono-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Process each pixel
    monoPixelStates = []; // Reset monoPixelStates
    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const i = (y * 32 + x) * 4;
            const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const isOn = brightness <= threshold;
            monoPixelStates.push(isOn);

            if (isOn) {
                // Draw LCD-style pixel with gaps
                ctx.fillStyle = '#1d4781';
                ctx.fillRect(
                    x * scaleFactor + 1,
                    y * scaleFactor + 1,
                    scaleFactor - 1,
                    scaleFactor - 1
                );
            }
        }
    }

    // Add this at the end
    updateMonoPaletteStates();
}

function createBMPData(pixelIndices, palette) {
    // Calculate file size including the color masks
    const headerSize = 14;        // Bitmap file header
    const dibSize = 56;           // Extended DIB header for BITFIELDS (includes masks)
    const rowSize = 32 * 4;       // 32 pixels * 4 bytes per pixel
    const pixelDataSize = rowSize * 32;  // 32 rows
    const fileSize = headerSize + dibSize + pixelDataSize;
    const pixelDataOffset = headerSize + dibSize;

    // BMP file header (14 bytes)
    const fileHeader = new Uint8Array([
        0x42, 0x4D,             // Signature 'BM'
        fileSize & 0xFF,        // File size (little-endian)
        (fileSize >> 8) & 0xFF,
        (fileSize >> 16) & 0xFF,
        (fileSize >> 24) & 0xFF,
        0x00, 0x00,             // Reserved
        0x00, 0x00,             // Reserved
        pixelDataOffset & 0xFF, // Offset to pixel data (little-endian)
        (pixelDataOffset >> 8) & 0xFF,
        (pixelDataOffset >> 16) & 0xFF,
        (pixelDataOffset >> 24) & 0xFF
    ]);

    // DIB header with BITFIELDS (56 bytes)
    const dibHeader = new Uint8Array([
        0x38, 0x00, 0x00, 0x00, // DIB header size (56)
        0x20, 0x00, 0x00, 0x00, // Width (32)
        0x20, 0x00, 0x00, 0x00, // Height (32)
        0x01, 0x00,             // Color planes
        0x20, 0x00,             // Bits per pixel (32)
        0x03, 0x00, 0x00, 0x00, // BI_BITFIELDS compression
        pixelDataSize & 0xFF,   // Image size
        (pixelDataSize >> 8) & 0xFF,
        (pixelDataSize >> 16) & 0xFF,
        (pixelDataSize >> 24) & 0xFF,
        0x00, 0x00, 0x00, 0x00, // X pixels per meter
        0x00, 0x00, 0x00, 0x00, // Y pixels per meter
        0x00, 0x00, 0x00, 0x00, // Total colors
        0x00, 0x00, 0x00, 0x00, // Important colors
        0x00, 0x00, 0xFF, 0x00, // Blue channel mask  (0x00FF0000)
        0x00, 0xFF, 0x00, 0x00, // Green channel mask (0x0000FF00)
        0xFF, 0x00, 0x00, 0x00, // Red channel mask   (0x000000FF)
        0x00, 0x00, 0x00, 0xFF  // Alpha channel mask (0xFF000000)
    ]);

    // Create pixel data array
    const pixelData = new Uint8Array(pixelDataSize);

    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const index = y * 32 + x;
            const paletteIndex = pixelIndices[index];
            const color = palette[paletteIndex];

            const newX = x;
            const newY = 31 - y;  // Flip vertically for BMP

            const dstOffset = (newY * rowSize) + (newX * 4);
            pixelData[dstOffset]     = color.b; // B
            pixelData[dstOffset + 1] = color.g; // G
            pixelData[dstOffset + 2] = color.r; // R
            pixelData[dstOffset + 3] = color.a; // A
        }
    }

    // Combine all parts into final BMP file
    const bmpData = new Uint8Array(fileSize);
    let offset = 0;
    bmpData.set(fileHeader, offset);
    offset += fileHeader.length;
    bmpData.set(dibHeader, offset);
    offset += dibHeader.length;
    bmpData.set(pixelData, offset);

    return bmpData;
}

function createMonoBMPData(monoPixelStates) {
    // Define a monochrome palette: black for "on" and white for "off"
    const monoPalette = [
        { r: 0, g: 0, b: 0, a: 255 },   // Black
        { r: 255, g: 255, b: 255, a: 255 } // White
    ];

    // Convert monoPixelStates to pixelIndices
    const pixelIndices = monoPixelStates.map(isOn => isOn ? 0 : 1);

    // Use the existing createBMPData function to generate the BMP data
    return createBMPData(pixelIndices, monoPalette);
}

/**
 * Create a GIF Blob from a 32x32 image given a palette and pixel data.
 * - width, height: dimensions (should be 32)
 * - palette: an array of 16 {r, g, b, a} objects (the 16th is assumed transparent)
 * - pixelIndices: an array of width*height numbers (each 0–15)
 */
function createGIFData(pixelIndices, palette) {
    const width = 32;
    const height = 32;
    let bytes = [];

    // --- GIF Header ("GIF89a") ---
    bytes.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);

    // --- Logical Screen Descriptor ---
    // Width & Height in little-endian order.
    bytes.push(width & 0xFF, (width >> 8) & 0xFF);
    bytes.push(height & 0xFF, (height >> 8) & 0xFF);
    // Packed Field:
    //   Global Color Table Flag = 1 (bit 7)
    //   Color Resolution = 7 (bits 4–6: meaning 8 bits per primary color)
    //   Sort Flag = 0 (bit 3)
    //   Size of Global Color Table = 3 (bits 0–2: 2^(3+1)=16 colors)
    let packed = (1 << 7) | (7 << 4) | (3);
    bytes.push(packed);
    // Background Color Index (0) and Pixel Aspect Ratio (0)
    bytes.push(0, 0);

    // --- Global Color Table (16 entries, 3 bytes each) ---
    for (let i = 0; i < 16; i++) {
        if (i < palette.length) {
            bytes.push(palette[i].r, palette[i].g, palette[i].b);
        } else {
        // Pad if needed.
            bytes.push(0, 0, 0);
        }
    }

    // Determine if transparency is needed
    const transparentIndex = palette.findIndex(color => color.a === 0);
    const hasTransparency = transparentIndex !== -1;

    // --- Graphic Control Extension (for transparency) ---
    // This block indicates that palette index 15 is transparent.
    bytes.push(0x21, 0xF9, 0x04);
    bytes.push(hasTransparency ? 0x01 : 0x00); // Set transparency flag if needed
    bytes.push(0, 0, hasTransparency ? transparentIndex : 0, 0);

    // --- Image Descriptor ---
    bytes.push(0x2C); // Image Separator.
    // Image Left and Top (0,0)
    bytes.push(0, 0, 0, 0);
    // Image Width & Height (little-endian)
    bytes.push(width & 0xFF, (width >> 8) & 0xFF);
    bytes.push(height & 0xFF, (height >> 8) & 0xFF);
    // Packed Field: no local color table, not interlaced.
    bytes.push(0);

    // --- Image Data ---
    // LZW Minimum Code Size – for 16 colors use 4.
    const lzwMinCodeSize = 4;
    bytes.push(lzwMinCodeSize);

    // Use our "brute force" LZW encoder that outputs a clear code before each pixel.
    const lzwData = lzwEncodeNoCompression(pixelIndices, lzwMinCodeSize);

    // Package the LZW data into sub-blocks (each block is at most 255 bytes).
    let offset = 0;
    while (offset < lzwData.length) {
        const blockSize = Math.min(255, lzwData.length - offset);
        bytes.push(blockSize);
        for (let i = 0; i < blockSize; i++) {
            bytes.push(lzwData[offset + i]);
        }
        offset += blockSize;
    }
    // Block Terminator for image data.
    bytes.push(0);

    // --- GIF Trailer ---
    bytes.push(0x3B);

    // Create and return the Blob.
    const byteArray = new Uint8Array(bytes);
    return new Blob([byteArray], { type: "image/gif" });
}

/**
 * A "no-compression" LZW encoder.
 *
 * This function writes a clear code, then for each pixel it writes:
 *   (clear code, then the pixel's palette index)
 * and finally writes the End-of-Information (EOI) code.
 *
 * This forces the decoder to output each pixel literally.
 *
 * @param {Array<number>} data - Array of palette indices (0–15), expected length = width*height.
 * @param {number} minCodeSize - LZW minimum code size (4 for 16-color images).
 * @returns {Array<number>} - The "LZW-compressed" data.
 */
function lzwEncodeNoCompression(data, minCodeSize) {
    const clearCode = 1 << minCodeSize; // For minCodeSize=4, clearCode = 16.
    const eoiCode = clearCode + 1;       // eoiCode = 17.
    const codeSize = minCodeSize + 1;      // Fixed code size = 5 bits.
    let output = [];
    let bitBuffer = 0;
    let bitCount = 0;

    // Helper function to write a code in codeSize bits into the bit stream.
    function writeCode(code) {
        bitBuffer |= code << bitCount;
        bitCount += codeSize;
        while (bitCount >= 8) {
            output.push(bitBuffer & 0xFF);
            bitBuffer >>= 8;
            bitCount -= 8;
        }
    }

    // For every pixel, output a clear code then the pixel's value.
    for (let i = 0; i < data.length; i++) {
        writeCode(clearCode);
        writeCode(data[i]);
    }
    // Write the End Of Information code.
    writeCode(eoiCode);

    // Flush any remaining bits.
    if (bitCount > 0) {
        output.push(bitBuffer & 0xFF);
    }
    return output;
}

async function uploadZipFile(zipBlob, filename) {
    const formData = new FormData();
    formData.append('zipFile', zipBlob, filename);

    try {
        const response = await fetch('upload.php', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.text();
            console.log('Upload successful:', result);
        } else {
            console.error('Upload failed:', response.statusText);
        }
    } catch (error) {
        console.error('Error uploading file:', error);
    }
}

async function saveVMSVMI() {
    const description = document.getElementById('description').value.toUpperCase();
    if (!description) {
        alert('Please enter a description');
        return;
    }

    const vmsData = createVMSData(description, monoPixelStates, storedPaletteIndices, currentPalette);
    const vmiData = createVMIData(description);
    const gifData = createGIFData(storedPaletteIndices, currentPalette);
    const bmpData = createBMPData(storedPaletteIndices, currentPalette);
    const monoBMPData = createMonoBMPData(monoPixelStates);

    try {
        // Create a new ZIP file
        const zip = new JSZip();

        // Add all files to the ZIP
        zip.file(`ICONDATA.VMS`, vmsData);
        zip.file(`ICONDATA.VMI`, vmiData);
        zip.file(`color.bmp`, bmpData);
        zip.file(`mono.bmp`, monoBMPData);
        zip.file(`preview.gif`, gifData);

        // Generate the ZIP file
        const zipBlob = await zip.generateAsync({type: "blob"});

        // Create download link for the ZIP file
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(zipBlob);
        downloadLink.download = `VMU_ICONDATA_${description}.zip`;

        // Save the ZIP file to the server
        uploadZipFile(zipBlob, `VMU_ICONDATA_${description}.zip`);

        // Save to history
        saveIconToHistory(description, gifData, monoBMPData, zipBlob, currentPalette, storedPaletteIndices, monoPixelStates);

        // Trigger the download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Clean up the URL object
        URL.revokeObjectURL(downloadLink.href);
    } catch (error) {
        console.error('Error creating GIF:', error);
        alert('Error creating preview GIF');
    }
}

function createVMIData(description) {
  const now = new Date();
  const vmiData = new Uint8Array(108);

  // Fill VMI data based on the Python logic
  vmiData.set([0x41, 0x41, 0x47, 0x40], 0); // 0x00, 4 bytes
  vmiData.set(new TextEncoder().encode('ICONDATA_GENERATOR').slice(0, 32), 4); // 0x04, 32 bytes
  vmiData.set(new TextEncoder().encode('@robertdalesmith').slice(0, 32), 36); // 0x24, 32 bytes
  vmiData.set([now.getFullYear() & 0xFF, (now.getFullYear() >> 8) & 0xFF], 68); // 0x44, 2 bytes
  vmiData.set([now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()], 70); // 0x46-0x4A, 5 bytes
  vmiData[75] = (now.getDay() + 1) % 7; // 0x4B, 1 byte
  vmiData.set([0x00, 0x01, 0x01, 0x00], 76); // 0x4C-0x4F, 4 bytes
  vmiData.set(new TextEncoder().encode('ICONDATAICONDATA_VMS').slice(0, 20), 80); // 0x50, 20 bytes
  vmiData.set([0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00], 100); // 0x64-0x6B, 8 bytes

  return vmiData;
}

function createVMSData(description, monoPixelStates, storedPaletteIndices, currentPalette) {
    const vmsData = new Uint8Array(1024);

    // 0x00, 16 bytes: Description
    const descriptionBytes = new TextEncoder('shift_jis').encode(description).slice(0, 16);
    vmsData.set(descriptionBytes, 0);

    // 0x10, 16 bytes: Fixed values
    vmsData.set([0x20, 0x00, 0x00, 0x00, 0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 16);

    // 0x20, 128 bytes: Mono bitmap data
    const monoBitmapBytes = convertMonoPixelStatesToBitmap(monoPixelStates);
    vmsData.set(monoBitmapBytes, 32);

    // 0xA0, 32 bytes: Color palette
    const colorPaletteBytes = convertPaletteToBytes(currentPalette);
    vmsData.set(colorPaletteBytes, 160);

    // 0xC0, 512 bytes: Color bitmap data
    const colorBitmapBytes = convertPaletteIndicesToBitmap(storedPaletteIndices);
    vmsData.set(colorBitmapBytes, 192);

    // 0x2C0: Add 3D mode sequence if enabled
    const threeDModeEnabled = document.getElementById('3d-mode-toggle').checked;
    if (threeDModeEnabled) {
        vmsData.set(THREED_MODE_SEQUENCE, 0x2C0);
    }

    // Fill remaining bytes with 0x00
    for (let i = 0x2C0 + (threeDModeEnabled ? 16 : 0); i < 1024; i++) {
        vmsData[i] = 0x00;
    }

    return vmsData;
}

function convertMonoPixelStatesToBitmap(monoPixelStates) {
    const bytes = [];
    for (let i = 0; i < monoPixelStates.length; i += 8) {
        const byte = monoPixelStates.slice(i, i + 8).reduce((acc, bit, index) => acc | (bit ? 1 : 0) << (7 - index), 0);
        bytes.push(byte);
    }
    return new Uint8Array(bytes.slice(0, 128));
}

function convertPaletteToBytes(palette) {
    const bytes = [];
    palette.forEach(color => {
        // Convert each color channel to 4 bits (0-15) and pack them into bytes
        const g = ((color.g >> 4) & 0xF) << 4 | ((color.b >> 4) & 0xF);
        const a = ((color.a >> 4) & 0xF) << 4 | ((color.r >> 4) & 0xF);
        bytes.push(g, a);
    });
    while (bytes.length < 32) {
        bytes.push(0x00);
    }
    return new Uint8Array(bytes.slice(0, 32));
}

function convertPaletteIndicesToBitmap(paletteIndices) {
    const bytes = [];
    for (let i = 0; i < paletteIndices.length; i += 2) {
        const byte = (paletteIndices[i] << 4) | (paletteIndices[i + 1] || 0);
        bytes.push(byte);
    }
    return new Uint8Array(bytes.slice(0, 512));
}

function getColorIndex(r, g, b, palette) {
    let closestIndex = 0;
    let minDistance = Infinity;
    for (let i = 0; i < palette.length; i += 2) {
        const pr = (palette[i + 1] & 0x0F) * 17;
        const pg = (palette[i] >> 4) * 17;
        const pb = (palette[i] & 0x0F) * 17;

        const distance = Math.sqrt(
            Math.pow(r - pr, 2) +
            Math.pow(g - pg, 2) +
            Math.pow(b - pb, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i / 2;
        }
    }
    return closestIndex;
}

function convertToColorBitmap(imageData, palette) {
    const bitmap = [];
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x += 2) {
            const index1 = (y * imageData.width + x) * 4;
            const index2 = (y * imageData.width + x + 1) * 4;

            const color1 = getColorIndex(imageData.data[index1], imageData.data[index1 + 1], imageData.data[index1 + 2], palette);
            const color2 = getColorIndex(imageData.data[index2], imageData.data[index2 + 1], imageData.data[index2 + 2], palette);

            const byte = (color1 << 4) | color2;
            bitmap.push(byte);
        }
    }
    return new Uint8Array(bitmap.slice(0, 512));
}

function saveFile(data, filename) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parsePSVFile(psvData) {
    const HEADER_SIZE = 0x84;
    const ICON_FRAME_SIZE = 128; // 16x16 pixels, 4 bits per pixel
    const CLUT_SIZE = 32; // 16 colors, 2 bytes each
    const DESCRIPTION_OFFSET = 0x64; // Example offset for description
    const DESCRIPTION_LENGTH = 0x14; // Example length for description

    // Extract the description text
    const descriptionBytes = psvData.slice(DESCRIPTION_OFFSET, DESCRIPTION_OFFSET + DESCRIPTION_LENGTH);
    const description = new TextDecoder('utf-8').decode(descriptionBytes).replace(/\0/g, '');
    document.getElementById('description').value = description;
    console.log('Description:', description);

    // Offsets based on the PSV format documentation
    const CLUT_OFFSET = HEADER_SIZE + 0x60;
    const ICON_OFFSET = HEADER_SIZE + 0x80;

    // Extract the color palette (CLUT)
    const clutData = psvData.slice(CLUT_OFFSET, CLUT_OFFSET + CLUT_SIZE);
    const palette = extractPSVPalette(clutData);

    // Extract the icon frame data
    const iconFrameData = psvData.slice(ICON_OFFSET, ICON_OFFSET + ICON_FRAME_SIZE);

    // Convert the icon frame data to palette indices
    const indices = convertIconFrameToIndices(iconFrameData);

    // Update storedPaletteIndices and currentPalette
    storedPaletteIndices = indices;

    // Render the canvas using your existing logic
    currentPalette = palette;
    updateCanvasWithPalette(currentPalette);
    displayColorPalette(currentPalette);
}

function convertIconFrameToIndices(iconFrameData) {
    const indices = [];
    const originalWidth = 16;
    const newWidth = 32;

    for (let y = 0; y < originalWidth; y++) {
        for (let x = 0; x < originalWidth; x += 2) {
            const byteIndex = y * (originalWidth / 2) + (x / 2);
            const byte = iconFrameData[byteIndex];

            // Each byte contains two pixels (4 bits per pixel)
            const highNibble = (byte >> 4) & 0x0F;
            const lowNibble = byte & 0x0F;

            // Duplicate each pixel to scale from 16x16 to 32x32
            indices.push(lowNibble, lowNibble, highNibble, highNibble);
        }
    }

    // Duplicate each row to complete the scaling
    const scaledIndices = [];
    for (let y = 0; y < originalWidth; y++) {
        const rowStart = y * newWidth;
        const row = indices.slice(rowStart, rowStart + newWidth);
        scaledIndices.push(...row, ...row);
    }

    return scaledIndices;
}

function convertIconFrameToRGBA(iconFrameData, palette) {
    const iconData = [];
    const width = 16; // Width of the icon

    for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x += 2) {
            const byteIndex = y * (width / 2) + (x / 2);
            const byte = iconFrameData[byteIndex];

            // Each byte contains two pixels (4 bits per pixel)
            const highNibble = (byte >> 4) & 0x0F;
            const lowNibble = byte & 0x0F;

            // Map the nibbles to the correct colors in the palette
            const pixel1 = palette[lowNibble];
            const pixel2 = palette[highNibble];

            // Push pixels in the correct order
            iconData.push(pixel1, pixel2);
        }
    }
    return iconData;
}

function extractPSVPalette(clutData) {
    const palette = [];
    for (let i = 0; i < clutData.length; i += 2) {
        const color = clutData[i] | (clutData[i + 1] << 8);

        // Extract and scale the color components
        const r = Math.round((((color >> 0) & 0x1F) * 15) / 31) * 17;
        const g = Math.round((((color >> 5) & 0x1F) * 15) / 31) * 17;
        const b = Math.round((((color >> 10) & 0x1F) * 15) / 31) * 17;
        const a = (color & 0x8000) ? 0 : 255; // Keep alpha as 0 or 255

        palette.push({ r: Math.round(r), g: Math.round(g), b: Math.round(b), a });
    }
    return palette;
}

function scaleIcon(iconData, originalWidth, originalHeight, newWidth, newHeight) {
    const scaledData = new Array(newWidth * newHeight);
    for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
            const origX = Math.floor(x * originalWidth / newWidth);
            const origY = Math.floor(y * originalHeight / newHeight);
            const origIndex = origY * originalWidth + origX;
            scaledData[y * newWidth + x] = iconData[origIndex];
        }
    }
    return scaledData;
}

function convertToImageData(iconData, width, height) {
    const imageData = new ImageData(width, height);
    for (let i = 0; i < iconData.length; i++) {
        const color = iconData[i];
        const index = i * 4;
        imageData.data[index] = color.r;
        imageData.data[index + 1] = color.g;
        imageData.data[index + 2] = color.b;
        imageData.data[index + 3] = color.a;
    }
    return imageData;
}

function parseDCMFile(dcmData) {
    const BLOCK_SIZE = 512;
    const TOTAL_BLOCKS = 256;
    const TOTAL_SIZE = BLOCK_SIZE * TOTAL_BLOCKS;

    // Check if the file is the correct size for a full memory dump
    if (dcmData.length !== TOTAL_SIZE) {
        throw new Error('Invalid DCM file: incorrect size');
    }

    // Correct the byte order by reversing every group of four bytes
    const correctedData = new Uint8Array(TOTAL_SIZE);
    for (let i = 0; i < dcmData.length; i += 4) {
        correctedData[i] = dcmData[i + 3];
        correctedData[i + 1] = dcmData[i + 2];
        correctedData[i + 2] = dcmData[i + 1];
        correctedData[i + 3] = dcmData[i];
    }

    // Extract the directory and FAT blocks
    const directoryBlocks = correctedData.slice(241 * BLOCK_SIZE, 254 * BLOCK_SIZE);
    const fatBlock = correctedData.slice(254 * BLOCK_SIZE, 255 * BLOCK_SIZE);

    // Parse the directory to find VMS files
    const vmsFiles = parseDirectory(directoryBlocks, fatBlock, correctedData);

    console.log('VMS files found within DCM file:', vmsFiles.length);

    if (vmsFiles.length > 0) {
        const triedIndices = new Set();
        let parsedSuccessfully = false;

        while (triedIndices.size < vmsFiles.length && !parsedSuccessfully) {
            const randomIndex = Math.floor(Math.random() * vmsFiles.length);

            // Skip if this index has already been tried
            if (triedIndices.has(randomIndex)) {
                continue;
            }

            triedIndices.add(randomIndex);

            try {
                const randomVmsData = vmsFiles[randomIndex];
                console.log('Parsing VMS file at index:', randomIndex);
                parseVMSFile(randomVmsData);
                parsedSuccessfully = true; // Exit loop if parsing is successful
            } catch (error) {
                console.error(`Error parsing VMS file at index ${randomIndex}:`, error);
            }
        }

        if (!parsedSuccessfully) {
            console.error('Failed to parse any VMS file.');
        }
    }
}

function parseDirectory(directoryData, fatData, correctedData) {
    const BLOCK_SIZE = 512;
    const DIRECTORY_ENTRY_SIZE = 32;
    const vmsFiles = [];

    for (let i = 0; i < directoryData.length; i += DIRECTORY_ENTRY_SIZE) {
        const entry = directoryData.slice(i, i + DIRECTORY_ENTRY_SIZE);

        // Check if the entry is used
        if (entry[0] !== 0x00) {
            const fileType = entry[0];
            const firstBlock = entry[2] | (entry[3] << 8);
            const fileSizeInBlocks = entry[0x18] | (entry[0x19] << 8);

            // Extract the VMS data using the FAT
            const vmsData = extractVMSData(firstBlock, fileSizeInBlocks, fatData, correctedData);
            vmsFiles.push(vmsData);
        }
    }

    return vmsFiles;
}

function extractVMSData(firstBlock, fileSizeInBlocks, fatData, correctedData) {
    const BLOCK_SIZE = 512;
    const vmsData = new Uint8Array(fileSizeInBlocks * BLOCK_SIZE);
    let currentBlock = firstBlock;
    let offset = 0;

    while (currentBlock < 0xFFFA && offset < vmsData.length) {
        const blockData = correctedData.slice(currentBlock * BLOCK_SIZE, (currentBlock + 1) * BLOCK_SIZE);
        vmsData.set(blockData, offset);
        offset += BLOCK_SIZE;

        // Get the next block from the FAT
        currentBlock = fatData[currentBlock * 2] | (fatData[currentBlock * 2 + 1] << 8);
    }

    return vmsData;
}

function parseDCIFile(dciData) {
    const DIRECTORY_ENTRY_SIZE = 32;

    // Check if the file is large enough to contain a directory entry
    if (dciData.length <= DIRECTORY_ENTRY_SIZE) {
        throw new Error('Invalid DCI file: too short');
    }

    // Extract the directory entry
    const directoryEntry = dciData.slice(0, DIRECTORY_ENTRY_SIZE);

    // Extract file size in blocks from the directory entry
    const fileSizeInBlocks = directoryEntry[0x18] | (directoryEntry[0x19] << 8);

    // Calculate the total data size (in bytes) based on the number of blocks
    const totalDataSize = fileSizeInBlocks * 512;

    // Check if the file contains enough data
    if (dciData.length < DIRECTORY_ENTRY_SIZE + totalDataSize) {
        throw new Error('DCI file is too short for the specified file size');
    }

    // Extract the file data blocks
    const fileData = dciData.slice(DIRECTORY_ENTRY_SIZE, DIRECTORY_ENTRY_SIZE + totalDataSize);

    // Correct the byte order by reversing every group of four bytes
    const correctedData = new Uint8Array(totalDataSize);
    for (let i = 0; i < fileData.length; i += 4) {
        correctedData[i] = fileData[i + 3];
        correctedData[i + 1] = fileData[i + 2];
        correctedData[i + 2] = fileData[i + 1];
        correctedData[i + 3] = fileData[i];
    }

    // Pass the corrected data to the VMS parser
    parseVMSFile(correctedData);
}

function parseVMSFile(vmsData) {
    // Check for 3D mode sequence at offset 0x2C0
    const has3DMode = check3DModeSequence(vmsData);

    // Update the checkbox
    document.getElementById('3d-mode-toggle').checked = has3DMode;

    // Clear both canvases before drawing new data
    const colorCanvas = document.getElementById('color-canvas');
    const colorCtx = colorCanvas.getContext('2d');
    colorCtx.clearRect(0, 0, colorCanvas.width, colorCanvas.height);

    // Attempt to detect ICONDATA_VMS file
    const isIconDataVMS = checkForIconDataSignature(vmsData) || checkForKnownPatterns(vmsData);

    if (isIconDataVMS) {
        console.log('Detected ICONDATA_VMS file');
        const colorIconOffset = (vmsData[20] | (vmsData[21] << 8) | (vmsData[22] << 16) | (vmsData[23] << 24));
        parseIconData(vmsData, colorIconOffset);
    } else {
        console.log('Detected game save file');
        parseSaveFileIcon(vmsData);
    }

    // Parse the main description for both file types
    parseMainDescription(vmsData);

    // Parse the boot ROM description only for game save files
    if (!isIconDataVMS) {
        parseBootRomDescription(vmsData);
    }

    // Update mono palette states after parsing
    updateMonoPaletteStates();
}

function checkForIconDataSignature(vmsData) {
    // Example check: Look for a specific header or pattern
    const signature = [0x41, 0x41, 0x47, 0x40]; // Example signature
    for (let i = 0; i < signature.length; i++) {
        if (vmsData[i] !== signature[i]) {
            return false;
        }
    }
    return true;
}

function checkForKnownPatterns(vmsData) {
    // Additional checks for known patterns or structures
    // Example: Check for specific offsets or data structures
    // This is a placeholder; replace with actual checks
    const knownPatternOffset = 0x10; // Example offset
    const knownPattern = [0x20, 0x00, 0x00, 0x00]; // Example pattern
    for (let i = 0; i < knownPattern.length; i++) {
        if (vmsData[knownPatternOffset + i] !== knownPattern[i]) {
            return false;
        }
    }
    return true;
}

function parseMainDescription(data) {
    // Parse the first 16 bytes for the VMS file menu description
    const menuDescriptionBytes = data.slice(0, 16);
    const menuDescription = new TextDecoder('shift_jis').decode(menuDescriptionBytes).replace(/\0/g, '').trim();
    // console.log('Menu Description:', menuDescription);

    // Update the UI with the menu description
    // document.getElementById('menu-description').textContent = menuDescription;
    document.getElementById('description').value = menuDescription;
}

function parseBootRomDescription(data) {
    // Parse the next 32 bytes for the DC boot ROM file manager description
    const bootRomDescriptionBytes = data.slice(16, 48);
    const bootRomDescription = new TextDecoder('shift_jis').decode(bootRomDescriptionBytes).replace(/\0/g, '').trim();
    console.log('Boot ROM Description:', bootRomDescription);

    // Update the UI with the boot ROM description
    // document.getElementById('boot-rom-description').textContent = bootRomDescription;
    document.getElementById('description').value = `${bootRomDescription}`.slice(0, 16);
}

function updateMonoPixelStates(monoBitmapData) {
    monoPixelStates = [];
    for (let i = 0; i < monoBitmapData.length; i++) {
        const byte = monoBitmapData[i];
        for (let bit = 0; bit < 8; bit++) {
            const isBlack = (byte & (1 << (7 - bit))) !== 0;
            monoPixelStates.push(isBlack);
        }
    }

    // Update mono palette states after updating pixel states
    updateMonoPaletteStates();
}

function parseIconData(data, offset) {
    const paletteOffset = offset;
    const bitmapOffset = offset + 32;
    const paletteSize = 32;
    const bitmapSize = 512;

    if (data.length >= bitmapOffset + bitmapSize) {
        const paletteData = data.slice(paletteOffset, paletteOffset + paletteSize);
        const bitmapData = data.slice(bitmapOffset, bitmapOffset + bitmapSize);
        const colorPalette = parseIconPalette(paletteData);
        const colorImageData = convertBitmapToImageData(bitmapData, colorPalette);
        drawImageDataToCanvas(colorImageData, 'color-canvas');

        // Display the color palette
        displayColorPalette(colorPalette);
    } else {
        console.error('File is too short to contain icon data');
    }

    // Parse monochrome icon if present
    const monoBitmapOffset = offset - 128; // Adjust based on actual format
    const monoBitmapSize = 128; // 32x32 pixels, 1 bit per pixel

    if (data.length >= monoBitmapOffset + monoBitmapSize) {
        const monoBitmapData = data.slice(monoBitmapOffset, monoBitmapOffset + monoBitmapSize);
        const monoImageData = convertMonoBitmapToImageData(monoBitmapData);
        drawImageDataToCanvas(monoImageData, 'mono-canvas');

        // Update monoPixelStates and mono palette
        updateMonoPixelStates(monoBitmapData);
    } else {
        console.error('File is too short to contain monochrome icon data');
    }

    // Ensure mono palette is updated after all parsing is complete
    updateMonoPaletteStates();
}

function parseIconPalette(paletteData) {
    const palette = [];
    for (let i = 0; i < paletteData.length; i += 2) {
        const color = (paletteData[i + 1] << 8) | paletteData[i];
        const a = ((color >> 12) & 0xF) * 17; // Scale 4-bit alpha to 8-bit
        const r = ((color >> 8) & 0xF) * 17;  // Scale 4-bit red to 8-bit
        const g = ((color >> 4) & 0xF) * 17;  // Scale 4-bit green to 8-bit
        const b = (color & 0xF) * 17;         // Scale 4-bit blue to 8-bit
        palette.push({ r, g, b, a });
    }
    return palette;
}

function convertBitmapToImageData(bitmapData, palette) {
    const imageData = new ImageData(32, 32);
    storedPaletteIndices = []; // Reset the stored indices

    for (let i = 0; i < bitmapData.length; i++) {
        const byte = bitmapData[i];
        const highNibble = byte >> 4;
        const lowNibble = byte & 0x0F;

        const highColor = palette[highNibble];
        const lowColor = palette[lowNibble];

        const highIndex = i * 2 * 4;
        const lowIndex = (i * 2 + 1) * 4;

        imageData.data[highIndex] = highColor.r;
        imageData.data[highIndex + 1] = highColor.g;
        imageData.data[highIndex + 2] = highColor.b;
        imageData.data[highIndex + 3] = highColor.a;

        imageData.data[lowIndex] = lowColor.r;
        imageData.data[lowIndex + 1] = lowColor.g;
        imageData.data[lowIndex + 2] = lowColor.b;
        imageData.data[lowIndex + 3] = lowColor.a;

        // Store the palette indices
        storedPaletteIndices.push(highNibble, lowNibble);
    }
    return imageData;
}

function drawImageDataToCanvas(imageData, canvasId) {
    // console.log('drawImageDataToCanvas', imageData);
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const scaledWidth = imageData.width * scaleFactor;
    const scaledHeight = imageData.height * scaleFactor;

    // Resize the canvas to match the scaled dimensions
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    // Create a new ImageData object for the scaled image
    const scaledImageData = ctx.createImageData(scaledWidth, scaledHeight);

    // Scale each pixel
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const index = (y * imageData.width + x) * 4;
            let r = imageData.data[index];
            let g = imageData.data[index + 1];
            let b = imageData.data[index + 2];
            let a = imageData.data[index + 3];

            // If this is the mono canvas and the pixel is black (value = 0)
            if (canvasId === 'mono-canvas' && r === 0) {
                // Draw LCD-style pixel with gaps
                ctx.fillStyle = '#1d4781';
                ctx.fillRect(
                    x * scaleFactor + 1,
                    y * scaleFactor + 1,
                    scaleFactor - 1,
                    scaleFactor - 1
                );
            } else if (canvasId === 'color-canvas') {
                // Draw the scaled pixel
                for (let dy = 0; dy < scaleFactor; dy++) {
                    for (let dx = 0; dx < scaleFactor; dx++) {
                        const scaledIndex = ((y * scaleFactor + dy) * scaledWidth + (x * scaleFactor + dx)) * 4;
                        scaledImageData.data[scaledIndex] = r;
                        scaledImageData.data[scaledIndex + 1] = g;
                        scaledImageData.data[scaledIndex + 2] = b;
                        scaledImageData.data[scaledIndex + 3] = a;
                    }
                }
            }
        }
    }

    // Only put the scaled image data for the color canvas
    if (canvasId === 'color-canvas') {
        ctx.putImageData(scaledImageData, 0, 0);
    }
    
    // console.log(`Image drawn on ${canvasId} with scale factor ${scaleFactor}`);
}

function getOriginalImageData(canvasId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const originalWidth = 32;
    const originalHeight = 32;
    const originalImageData = ctx.createImageData(originalWidth, originalHeight);

    // Extract the original 32x32 image data from the scaled canvas
    for (let y = 0; y < originalHeight; y++) {
        for (let x = 0; x < originalWidth; x++) {
            const index = (y * originalWidth + x) * 4;
            const scaledIndex = ((y * scaleFactor) * canvas.width + (x * scaleFactor)) * 4;
            originalImageData.data[index] = ctx.getImageData(0, 0, canvas.width, canvas.height).data[scaledIndex];
            originalImageData.data[index + 1] = ctx.getImageData(0, 0, canvas.width, canvas.height).data[scaledIndex + 1];
            originalImageData.data[index + 2] = ctx.getImageData(0, 0, canvas.width, canvas.height).data[scaledIndex + 2];
            originalImageData.data[index + 3] = ctx.getImageData(0, 0, canvas.width, canvas.height).data[scaledIndex + 3];
        }
    }

    return originalImageData;
}

function parseSaveFileIcon(saveData) {
    // Read the header to find the icon palette and bitmap
    const paletteOffset = 0x60; // Offset for the icon palette
    const bitmapOffset = 0x80;  // Offset for the icon bitmap
    const paletteSize = 32;     // 16 colors, 2 bytes each
    const bitmapSize = 512;     // 32x32 pixels, 4 bits per pixel

    if (saveData.length >= bitmapOffset + bitmapSize) {
        const paletteData = saveData.slice(paletteOffset, paletteOffset + paletteSize);
        const bitmapData = saveData.slice(bitmapOffset, bitmapOffset + bitmapSize);
        const colorPalette = parseIconPalette(paletteData);
        const colorImageData = convertBitmapToImageData(bitmapData, colorPalette);
        drawImageDataToCanvas(colorImageData, 'color-canvas');

        // Display the color palette
        displayColorPalette(colorPalette);
    } else {
        throw new Error('Save file is too short to contain icon data');
        console.error('Save file is too short to contain icon data');
    }
}

function convertMonoBitmapToImageData(bitmapBytes) {
    const imageData = new ImageData(32, 32);
    for (let i = 0; i < bitmapBytes.length; i++) {
        const byte = bitmapBytes[i];
        for (let bit = 0; bit < 8; bit++) {
            const pixelIndex = i * 8 + bit;
            const value = (byte & (1 << (7 - bit))) ? 0 : 255;
            const dataIndex = pixelIndex * 4;
            imageData.data[dataIndex] = value; // R
            imageData.data[dataIndex + 1] = value; // G
            imageData.data[dataIndex + 2] = value; // B
            imageData.data[dataIndex + 3] = 255; // A
        }
    }
    return imageData;
}

// Add this helper function to check for 3D mode sequence
function check3DModeSequence(vmsData) {
    // Start checking at offset 0x2C0
    const offset = 0x2C0;

    // Check if each byte matches the sequence
    for (let i = 0; i < THREED_MODE_SEQUENCE.length; i++) {
        if (vmsData[offset + i] !== THREED_MODE_SEQUENCE[i]) {
            return false;
        }
    }

    return true;
}

// Initialize the color indicators and both canvases
document.addEventListener('DOMContentLoaded', () => {
    redInput = document.getElementById('red');
    greenInput = document.getElementById('green');
    blueInput = document.getElementById('blue');
    alphaInput = document.getElementById('alpha');

    function setupCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        const pixelSize = 32;
        canvas.width = pixelSize * scaleFactor;
        canvas.height = pixelSize * scaleFactor;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Make canvas transparent by default
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let drawing = false;
        let currentButton = null;

        // Helper function to get canvas coordinates from both mouse and touch events
        function getCanvasCoordinates(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: Math.floor((clientX - rect.left) / scaleFactor),
                y: Math.floor((clientY - rect.top) / scaleFactor)
            };
        }

        function draw(e) {
            const coords = getCanvasCoordinates(e);
            const x = coords.x;
            const y = coords.y;

            // Ensure coordinates are within canvas bounds
            if (x < 0 || x >= pixelSize || y < 0 || y >= pixelSize) return;

            if (canvasId === 'mono-canvas') {
                // For monochrome canvas, use monoDrawPrimary/Secondary
                const index = y * pixelSize + x;
                const isOn = currentButton === 0 ? monoDrawPrimary : monoDrawSecondary;
                monoPixelStates[index] = isOn;

                if (isOn) {
                    // Draw the pixel with LCD-style gaps
                    ctx.fillStyle = '#1d4781';
                    // Draw the pixel slightly smaller and offset by 1px
                    ctx.fillRect(
                        x * scaleFactor + 1, // Offset by 1px from left
                        y * scaleFactor + 1, // Offset by 1px from top
                        scaleFactor - 1,     // Reduce width by 1px
                        scaleFactor - 1      // Reduce height by 1px
                    );
                } else {
                    // Clear the pixel
                    ctx.clearRect(x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor);
                }
            } else {
                // For color canvas, update storedPaletteIndices
                const color = currentButton === 2 ? secondaryColor : primaryColor;
                const colorIndex = currentButton === 2 ? secondaryColorIndex : primaryColorIndex;

                // Update the stored palette index for this pixel
                const index = y * pixelSize + x;
                storedPaletteIndices[index] = colorIndex;

                // Clear the pixel area first
                ctx.clearRect(x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor);

                // Draw the scaled pixel with color
                ctx.fillStyle = color;
                ctx.fillRect(x * scaleFactor, y * scaleFactor, scaleFactor, scaleFactor);
            }

            // Update mono palette states if needed
            if (canvasId === 'color-canvas' || canvasId === 'mono-canvas') {
                updateMonoPaletteStates();
            }
        }

        // Mouse event listeners
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0 || e.button === 2) {
                drawing = true;
                currentButton = e.button;
                draw(e);
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (drawing) draw(e);
        });

        canvas.addEventListener('mouseup', () => {
            drawing = false;
            currentButton = null;
            ctx.beginPath();
        });

        canvas.addEventListener('mouseleave', () => {
            drawing = false;
            currentButton = null;
            ctx.beginPath();
        });

        // Touch event listeners
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling while drawing
            drawing = true;
            currentButton = 0; // Default to primary color for touch
            draw(e);
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (drawing) draw(e);
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            drawing = false;
            currentButton = null;
            ctx.beginPath();
        });

        canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            drawing = false;
            currentButton = null;
            ctx.beginPath();
        });

        // Prevent context menu on right-click
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Add this at the end of the draw function
        if (canvasId === 'color-canvas' || canvasId === 'mono-canvas') {
            updateMonoPaletteStates();
        }
    }

    updateColorIndicators();
    setupCanvas('color-canvas');
    setupCanvas('mono-canvas');

    // Define a default palette with 16 colors
    const defaultPalette = [
        { r: 0, g: 0, b: 0, a: 255 },       // Black
        { r: 255, g: 255, b: 255, a: 255 }, // White
        { r: 255, g: 0, b: 0, a: 255 },     // Red
        { r: 0, g: 255, b: 0, a: 255 },     // Green
        { r: 0, g: 0, b: 255, a: 255 },     // Blue
        { r: 255, g: 255, b: 0, a: 255 },   // Yellow
        { r: 0, g: 255, b: 255, a: 255 },   // Cyan
        { r: 255, g: 0, b: 255, a: 255 },   // Magenta
        { r: 187, g: 187, b: 187, a: 255 }, // Silver (11*17)
        { r: 136, g: 136, b: 136, a: 255 }, // Gray (8*17)
        { r: 136, g: 0, b: 0, a: 255 },     // Maroon (8*17)
        { r: 136, g: 136, b: 0, a: 255 },   // Olive (8*17)
        { r: 0, g: 136, b: 0, a: 255 },     // Dark Green (8*17)
        { r: 136, g: 0, b: 136, a: 255 },   // Purple (8*17)
        { r: 0, g: 136, b: 136, a: 255 },   // Teal (8*17)
        { r: 0, g: 0, b: 136, a: 255 }      // Navy (8*17)
    ];

    // Render the default palette
    displayColorPalette(defaultPalette);

    // Initialize the canvas with the default palette
    currentPalette = defaultPalette;
    updateCanvasWithPalette(currentPalette);

    document.getElementById('color-indicators').addEventListener('click', function() {
        // Swap the primary and secondary colors
        [primaryColor, secondaryColor] = [secondaryColor, primaryColor];
        [primaryColorIndex, secondaryColorIndex] = [secondaryColorIndex, primaryColorIndex];

        // Update the color indicators to reflect the change
        updateColorIndicators();
    });

    function validateInput(input) {
        let value = parseInt(input.value);
        if (value < 0) {
            value = Math.abs(value); // Make it positive
        }
        if (value > 15) {
            value = parseInt(value.toString().charAt(0)); // Truncate to first digit
        }
        input.value = value;
    }

    redInput.addEventListener('blur', () => validateInput(redInput));
    greenInput.addEventListener('blur', () => validateInput(greenInput));
    blueInput.addEventListener('blur', () => validateInput(blueInput));
    alphaInput.addEventListener('blur', () => validateInput(alphaInput));

    redInput.addEventListener('input', updateColorPreview);
    greenInput.addEventListener('input', updateColorPreview);
    blueInput.addEventListener('input', updateColorPreview);
    alphaInput.addEventListener('input', updateColorPreview);

    updateColorPreview(); // Initialize the preview

    displayColorPalette(currentPalette); // Initial display of the palette

    // Update the hueSlider click event to move the indicator
    hueSlider.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = hueSlider.getBoundingClientRect();
        hueIndicatorX = e.clientX - rect.left;
        currentHue = hueIndicatorX / hueSlider.width;
        drawHueSlider();
        drawColorCanvas(currentHue);
        updateColorFromPosition(colorIndicatorX, colorIndicatorY);
        drawCircle(colorIndicatorX, colorIndicatorY);
    });

    // Add event listeners for dragging the hue indicator
    hueSlider.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isHueSliderDragging = true;
        updateHueIndicatorPosition(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isHueSliderDragging) {
            e.stopPropagation();
            updateHueIndicatorPosition(e);
        }
    });

    document.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        isHueSliderDragging = false;
    });

    function updateHueIndicatorPosition(e) {
        const rect = hueSlider.getBoundingClientRect();
        hueIndicatorX = Math.max(0, Math.min(e.clientX - rect.left, hueSlider.width));
        currentHue = hueIndicatorX / hueSlider.width;
        drawHueSlider();
        drawColorCanvas(currentHue);
        updateColorFromPosition(colorIndicatorX, colorIndicatorY);
        drawCircle(colorIndicatorX, colorIndicatorY);
        drawOpacitySlider();
    }

    // Handle hue selection
    hueSlider.addEventListener('click', (e) => {
        const rect = hueSlider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        currentHue = x / hueSlider.width;
        drawColorCanvas(currentHue);
        drawCircle(colorIndicatorX, colorIndicatorY);
    });

    // Handle mouse events for dragging
    colorPickerCanvas.addEventListener('mousedown', (e) => {
        isColorPickerDragging = true;
        updateCirclePosition(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isColorPickerDragging) {
            updateCirclePosition(e);
        }
    });

    document.addEventListener('mouseup', () => {
        isColorPickerDragging = false;
    });

    function updateCirclePosition(e) {
        const rect = colorPickerCanvas.getBoundingClientRect();
        colorIndicatorX = Math.max(0, Math.min(e.clientX - rect.left, colorPickerCanvas.width - 1));
        colorIndicatorY = Math.max(0, Math.min(e.clientY - rect.top, colorPickerCanvas.height - 1));
        drawColorCanvas(currentHue);
        drawCircle(colorIndicatorX, colorIndicatorY);
        updateColorFromPosition(colorIndicatorX, colorIndicatorY);
    }

    function updateColorFromPosition(x, y) {
        const imageData = colorCtx.getImageData(x, y, 1, 1).data;
        const [r, g, b] = imageData;
        const currentAlpha = parseInt(alphaInput.value); // Keep the current alpha value

        // Update the primary color
        if (currentPaletteIndex === primaryColorIndex) {
            primaryColor = rgbaToHex(r, g, b, currentAlpha * 17);
            updateColorIndicators();
        }
        if (currentPaletteIndex === secondaryColorIndex) {
            secondaryColor = rgbaToHex(r, g, b, currentAlpha * 17);
            updateColorIndicators();
        }

        // Update sliders and preview
        redInput.value = r / 17;
        greenInput.value = g / 17;
        blueInput.value = b / 17;
        // Don't update the alpha input, keep its current value
        updateColorPreview();
        drawOpacitySlider();

        // Update the palette
        if (currentPaletteIndex !== null) {
            currentPalette[currentPaletteIndex] = { r, g, b, a: currentAlpha * 17 };
            displayColorPalette(currentPalette);
            updateCanvasWithPalette(currentPalette);
        }
    }

    drawHueSlider();
    drawColorCanvas(currentHue); // Initialize with red

    drawOpacitySlider();

    // Get the unified file input element
    const unifiedFileLabel = document.querySelector('label[for="unified-file"]');

    // Prevent default drag behaviors on the entire document
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, preventDefaults, false);
        // unifiedFileLabel.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        document.addEventListener(eventName, () => {
            document.body.classList.add('dragging');
            unifiedFileLabel.classList.add('highlight');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, () => {
            document.body.classList.remove('dragging');
            unifiedFileLabel.classList.remove('highlight');
        }, false);
    });

    // Handle dropped files anywhere on the document
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        handleFileInput(file);
    });

    // Initialize mono palette
    displayMonoPalette();

    // Add click handler for mono color indicators
    document.getElementById('mono-color-indicators').addEventListener('click', function() {
        // Swap the primary and secondary mono drawing states
        [monoDrawPrimary, monoDrawSecondary] = [monoDrawSecondary, monoDrawPrimary];
        updateMonoColorIndicators();
    });

    // Initialize mono color indicators
    updateMonoColorIndicators();

    // Initialize icon history
    renderIconHistory();
});

function rgbToHsb(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = max === 0 ? 0 : delta / max;
    let v = max;

    if (delta !== 0) {
        switch (max) {
            case r:
                h = (g - b) / delta + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / delta + 2;
                break;
            case b:
                h = (r - g) / delta + 4;
                break;
        }
        h /= 6;
    }

    return [h, s, v];
}

document.addEventListener('mousedown', function(event) {
    const customColorPicker = document.getElementById('custom-color-picker');
    if (customColorPicker && !customColorPicker.contains(event.target)) {
        customColorPicker.style.display = 'none';
    }
});

// Update the drawOpacitySlider function
function drawOpacitySlider() {
    const width = opacitySlider.width;
    const height = opacitySlider.height;
    
    // Get current RGB values and scale them from 4-bit to 8-bit
    // Add default values of 0 if inputs are empty or NaN
    const r = (parseInt(redInput.value) || 0) * 17;
    const g = (parseInt(greenInput.value) || 0) * 17;
    const b = (parseInt(blueInput.value) || 0) * 17;
    
    // Clear the canvas first
    opacityCtx.clearRect(0, 0, width, height);
    
    // Create gradient from transparent to solid color
    const gradient = opacityCtx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 1)`);
    
    // Draw the gradient background
    opacityCtx.fillStyle = gradient;
    opacityCtx.fillRect(0, 0, width, height);

    // Add shadow before drawing the indicator
    opacityCtx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    opacityCtx.shadowBlur = 2;
    opacityCtx.shadowOffsetX = 1;

    // Draw the indicator at the current position
    opacityCtx.beginPath();
    opacityCtx.arc(opacityIndicatorX, height / 2, height / 2, 0, Math.PI * 2);
    opacityCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacityIndicatorX / width})`; 
    opacityCtx.fill();
    opacityCtx.strokeStyle = 'white';
    opacityCtx.lineWidth = 3;
    opacityCtx.stroke();

    // Reset shadow settings
    opacityCtx.shadowColor = 'transparent';
    opacityCtx.shadowBlur = 2;
    opacityCtx.shadowOffsetX = 0;
}

// Add opacity slider event listeners
let isOpacitySliderDragging = false;

opacitySlider.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isOpacitySliderDragging = true;
    updateOpacityIndicatorPosition(e);
});

document.addEventListener('mousemove', (e) => {
    if (isOpacitySliderDragging) {
        e.stopPropagation();
        updateOpacityIndicatorPosition(e);
    }
});

document.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    isOpacitySliderDragging = false;
});

function updateOpacityIndicatorPosition(e) {
    const rect = opacitySlider.getBoundingClientRect();
    opacityIndicatorX = Math.max(0, Math.min(e.clientX - rect.left, opacitySlider.width));
    const opacity = Math.round((opacityIndicatorX / opacitySlider.width) * 15); // Convert to 4-bit (0-15)
    alphaInput.value = opacity;
    drawOpacitySlider();
    updateColorPreview();
}

function displayMonoPalette() {
    const paletteContainer = document.getElementById('mono-palette');
    paletteContainer.innerHTML = ''; // Clear previous palette

    const squareSize = 24; // Match color palette size
    const columns = 8;
    const gap = '0 0';
    const borderSize = 1;
    const margin = 5; // 5px margin for the inner square

    // Calculate the total width of the palette container
    const totalWidth = columns * (squareSize + gap) - gap;

    // Set the palette container to display as a grid
    paletteContainer.style.display = 'grid';
    paletteContainer.style.gridTemplateColumns = `repeat(${columns}, ${squareSize + (borderSize * 2)}px)`;
    paletteContainer.style.gap = `${gap}px`;
    paletteContainer.style.width = `${totalWidth}px`;
    paletteContainer.style.border = `${borderSize}px solid #000`;
    paletteContainer.style.borderRadius = '2px';

    // Create squares for each palette index
    for (let index = 0; index < 16; index++) {
        const toggleDiv = document.createElement('div');
        toggleDiv.style.width = `${squareSize}px`;
        toggleDiv.style.height = `${squareSize}px`;
        toggleDiv.style.border = '1px solid #000';
        toggleDiv.style.cursor = 'pointer';
        toggleDiv.style.position = 'relative'; // For absolute positioning of inner square
        toggleDiv.style.background = 'linear-gradient(to bottom, #8af8db, #68a38f)';
        toggleDiv.id = 'mono-palette-item-index-' + index;

        // Determine the state: off, partial-on, or on
        let onCount = 0;
        let totalCount = 0;

        for (let i = 0; i < storedPaletteIndices.length; i++) {
            if (storedPaletteIndices[i] === index) {
                totalCount++;
                if (monoPixelStates[i]) {
                    onCount++;
                }
            }
        }

        const innerSquare = document.createElement('div');
        innerSquare.style.position = 'absolute';
        innerSquare.style.top = `${margin}px`;
        innerSquare.style.left = `${margin}px`;
        innerSquare.style.width = `${squareSize - (margin * 2)}px`;
        innerSquare.style.height = `${squareSize - (margin * 2)}px`;

        if (onCount === totalCount && totalCount > 0) {
            // All On: Inner square is fully filled
            innerSquare.style.backgroundColor = '#1d4781';
            innerSquare.style.top = `1px`;
            innerSquare.style.left = `1px`;
            innerSquare.style.width = `${squareSize - 2}px`;
            innerSquare.style.height = `${squareSize - 2}px`;
        } else if (onCount > 0) {
            // Partial On: Inner square is partially filled (e.g., with a pattern or lighter color)
            innerSquare.style.backgroundColor = '#1d4781';
        } else {
            // All Off: No inner square or transparent
            innerSquare.style.backgroundColor = 'transparent';
        }

        toggleDiv.appendChild(innerSquare);

        toggleDiv.addEventListener('click', () => {
            toggleMonoPaletteIndex(index);
        });

        paletteContainer.appendChild(toggleDiv);
    }
}

function toggleMonoPaletteIndex(index) {
    // Toggle the state
    monoPaletteStates[index] = !monoPaletteStates[index];

    // Update all mono pixels that match this color index
    for (let i = 0; i < storedPaletteIndices.length; i++) {
        if (storedPaletteIndices[i] === index) {
            monoPixelStates[i] = monoPaletteStates[index];
        }
    }

    // Redraw mono canvas
    const canvas = document.getElementById('mono-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw updated mono pixels
    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const index = y * 32 + x;
            if (monoPixelStates[index]) {
                ctx.fillStyle = '#1d4781';
                ctx.fillRect(
                    x * scaleFactor + 1,
                    y * scaleFactor + 1,
                    scaleFactor - 1,
                    scaleFactor - 1
                );
            }
        }
    }

    // Update mono palette display
    displayMonoPalette();
}

function updateMonoPaletteStates() {
    // Reset all states
    monoPaletteStates.fill(false);

    // For each palette index, check if all corresponding pixels are on
    for (let paletteIndex = 0; paletteIndex < 16; paletteIndex++) {
        let allOn = true;
        let hasPixels = false;

        // Check all pixels for this palette index
        for (let i = 0; i < storedPaletteIndices.length; i++) {
            if (storedPaletteIndices[i] === paletteIndex) {
                hasPixels = true;
                if (!monoPixelStates[i]) {
                    allOn = false;
                    break;
                }
            }
        }

        // Only set true if there were matching pixels and they were all on
        monoPaletteStates[paletteIndex] = hasPixels && allOn;
    }

    // Update the display
    displayMonoPalette();
}

// Add this new function
function updateMonoColorIndicators() {
    const primaryIndicator = document.getElementById('mono-primary-color-indicator');
    const secondaryIndicator = document.getElementById('mono-secondary-color-indicator');

    // Set the base background to the gradient
    primaryIndicator.style.background = 'linear-gradient(to bottom, #8af8db, #68a38f)';
    secondaryIndicator.style.background = 'linear-gradient(to bottom, #8af8db, #68a38f)';

    // Add a smaller square if true
    if (monoDrawPrimary) {
        primaryIndicator.style.background = '#1d4781';
        primaryIndicator.style.boxShadow = 'inset 0 0 0 1px #8af8db, inset 0 0 0 3px #1d4781';
    } else {
        primaryIndicator.style.boxShadow = 'none';
    }

    if (monoDrawSecondary) {
        secondaryIndicator.style.background = '#1d4781';
        secondaryIndicator.style.boxShadow = 'inset 0 0 0 1px #8af8db, inset 0 0 0 3px #1d4781';
    } else {
        secondaryIndicator.style.boxShadow = 'none';
    }
}

function invertMonoStates() {
    // Invert each pixel state
    for (let i = 0; i < monoPixelStates.length; i++) {
        monoPixelStates[i] = !monoPixelStates[i];
    }

    // Redraw the mono canvas
    const canvas = document.getElementById('mono-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw updated mono pixels
    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const index = y * 32 + x;
            if (monoPixelStates[index]) {
                ctx.fillStyle = '#1d4781';
                ctx.fillRect(
                    x * scaleFactor + 1,
                    y * scaleFactor + 1,
                    scaleFactor - 1,
                    scaleFactor - 1
                );
            }
        }
    }

    // Update mono palette display
    displayMonoPalette();
}

// Add event listener to the button
document.getElementById('invert-mono-button').addEventListener('click', invertMonoStates);

let db;
let dbReady = new Promise((resolve, reject) => {
    const request = indexedDB.open('iconDatabase', 1);

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        const objectStore = db.createObjectStore('icons', { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('description', 'description', { unique: false });
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        resolve();
    };

    request.onerror = function(event) {
        console.error('Database error:', event.target.errorCode);
        reject(event.target.errorCode);
    };
});

function saveIconToHistory(description, gifData, monoBMPData, zipData, currentPalette, storedPaletteIndices, monoPixelStates) {
    dbReady.then(() => {
        const transaction = db.transaction(['icons'], 'readwrite');
        const objectStore = transaction.objectStore('icons');
        const threeDModeEnabled = document.getElementById('3d-mode-toggle').checked;

        const iconEntry = {
            description: description,
            gifData: gifData,
            zipData: zipData,
            currentPalette: currentPalette,
            storedPaletteIndices: storedPaletteIndices,
            monoPixelStates: monoPixelStates,
            monoBMPData: monoBMPData, // Store the mono BMP data
            threeDModeEnabled: threeDModeEnabled,
            timestamp: Date.now() // Add a timestamp when saving
        };

        const request = objectStore.add(iconEntry);

        request.onsuccess = function() {
            console.log('Icon saved to history');
            renderIconHistory();
        };

        request.onerror = function(event) {
            console.error('Error saving icon:', event.target.errorCode);
        };
    }).catch(error => {
        console.error('Failed to save icon:', error);
    });
}

function renderIconHistory() {
    dbReady.then(() => {
        const historyList = document.getElementById('history-list');
        const historyContainer = document.getElementById('history-container');

        historyList.innerHTML = ''; // Clear existing history

        const transaction = db.transaction(['icons'], 'readonly');
        const objectStore = transaction.objectStore('icons');

        const icons = [];

        objectStore.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const icon = cursor.value;
                icons.push(icon);
                cursor.continue();
            } else {
                // Sort icons by timestamp in descending order
                icons.sort((a, b) => b.timestamp - a.timestamp);

                // Check if there are any icons to display
                if (icons.length > 0) {
                    historyContainer.style.display = 'block'; // Show the container
                } else {
                    historyContainer.style.display = 'none'; // Hide the container
                }

                // Render sorted icons
                icons.forEach(icon => {
                    const iconDiv = document.createElement('div');
                    iconDiv.className = 'history-item';
                    iconDiv.setAttribute('data-id', icon.id);

                    const gifImg = document.createElement('img');
                    gifImg.src = URL.createObjectURL(new Blob([icon.gifData], { type: 'image/gif' }));
                    gifImg.alt = 'GIF Preview';
                    gifImg.style.width = '64px';
                    gifImg.style.imageRendering = 'pixelated';

                    const monoImg = document.createElement('img');
                    monoImg.src = URL.createObjectURL(new Blob([icon.monoBMPData], { type: 'image/bmp' }));
                    monoImg.alt = 'Mono BMP Preview';
                    monoImg.style.width = '64px';
                    monoImg.style.imageRendering = 'pixelated';

                    const descriptionElement = document.createElement('div');
                    descriptionElement.textContent = icon.description;

                    const date = new Date(icon.timestamp);
                    const dateString = date.toLocaleString();

                    const timestampElement = document.createElement('div');
                    timestampElement.textContent = `Created: ${dateString}`;
                    timestampElement.style.fontSize = '0.8em';

                    const buttonsElement = document.createElement('div');
                    buttonsElement.className = 'history-item-buttons';

                    const downloadZipButton = document.createElement('button');
                    downloadZipButton.textContent = 'Download';
                    downloadZipButton.onclick = () => downloadFile(icon.zipData, `VMU_ICONDATA_${icon.description}.zip`);

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete';

                    (function(id) {
                        deleteButton.addEventListener('click', (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const confirmed = confirm('Are you sure you want to delete this icon?');
                            if (confirmed) {
                                deleteIconFromHistory(id);
                            }
                        });
                    })(icon.id);

                    const reopenButton = document.createElement('button');
                    reopenButton.textContent = 'Load';
                    reopenButton.onclick = () => reopenIconInEditor(icon);

                    iconDiv.appendChild(gifImg);
                    if (icon.monoBMPData) iconDiv.appendChild(monoImg);
                    const iconDescDiv = document.createElement('div');
                    iconDescDiv.className = 'history-item-desc';

                    iconDescDiv.appendChild(descriptionElement);
                    iconDescDiv.appendChild(timestampElement);
                    buttonsElement.appendChild(reopenButton);
                    buttonsElement.appendChild(downloadZipButton);
                    buttonsElement.appendChild(deleteButton);
                    iconDescDiv.appendChild(buttonsElement);
                    iconDiv.appendChild(iconDescDiv);

                    historyList.appendChild(iconDiv);
                });
            }
        };
    }).catch(error => {
        console.error('Failed to render icon history:', error);
    });
}

function downloadFile(data, filename) {
    const blob = new Blob([data], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Clean up the URL object
}

function deleteIconFromHistory(id) {
    dbReady.then(() => {
        const transaction = db.transaction(['icons'], 'readwrite');
        const objectStore = transaction.objectStore('icons');

        const request = objectStore.delete(id);

        request.onsuccess = function() {
            console.log('Icon deleted from history');

            // Remove the specific element from the DOM
            const historyItem = document.querySelector(`.history-item[data-id="${id}"]`);
            if (historyItem) {
                historyItem.remove();
            }

            // Check if there are any remaining items and hide the container if empty
            const historyList = document.getElementById('history-list');
            if (historyList.children.length === 0) {
                const historyContainer = document.getElementById('history-container');
                historyContainer.style.display = 'none';
            }
        };

        request.onerror = function(event) {
            console.error('Error deleting icon:', event.target.errorCode);
        };
    }).catch(error => {
        console.error('Failed to delete icon:', error);
    });
}

function reopenIconInEditor(icon) {
    // Load the icon data back into the editor
    console.log('Reopening icon:', icon);

    // Scroll the page to the top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Set the current state to the icon's data
    currentPalette = icon.currentPalette;
    storedPaletteIndices = icon.storedPaletteIndices;
    monoPixelStates = icon.monoPixelStates;

    // Restore the 3D mode state
    document.getElementById('3d-mode-toggle').checked = icon.threeDModeEnabled;

    // Update the description field
    document.getElementById('description').value = icon.description;

    // Update the UI with the loaded data
    updateCanvasWithPalette(currentPalette);
    displayColorPalette(currentPalette); // Update the color palette display
    displayMonoPalette();

    // Redraw the mono canvas
    const canvas = document.getElementById('mono-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw updated mono pixels
    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const index = y * 32 + x;
            if (monoPixelStates[index]) {
                ctx.fillStyle = '#1d4781';
                ctx.fillRect(
                    x * scaleFactor + 1,
                    y * scaleFactor + 1,
                    scaleFactor - 1,
                    scaleFactor - 1
                );
            }
        }
    }

    // Additional updates as needed
    updateMonoPaletteStates();
}
